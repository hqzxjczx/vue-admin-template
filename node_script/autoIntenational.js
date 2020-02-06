// import htmlP from "vue/src/compiler/index.js";
const vue = require("vue");
const compiler = require("vue-template-compiler");
const compilerES5 = require("vue-template-es2015-compiler");

// const script = require("babel-loader!vue-loader!source.vue?vue&type=script");
// import script from "babel-loader!vue-loader!source.vue?vue&type=script";

// log(script);
const { promisify, inspect } = require("util");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const { resolve } = path;

// // var htmlP = require("../node_modules/vue/src/compiler/parser/html-parser.js");
// log(htmlP);

function log(obj, options) {
  let defaultOptions = { showHidden: false, depth: null };
  options &&
    ((typeof options == "string" && console.log(options)) ||
      (typeof options == "object" &&
        (defaultOptios = Object.assign(defaultOptions, options)) &&
        defaultOptions.desc &&
        console.log(defaultOptions.desc)));
  console.log(inspect(obj, defaultOptions));
}
// log(vue);
log(compiler);
// log(compilerES5);
function convertToArr(v) {
  return v ? (Array.isArray(v) ? v : [v]) : null;
}

function isExistChineseStr(str) {
  return /[\u4e00-\u9fa5]/g.test(str);
}

function filterAndReduceConcat(arr) {
  if (!arr || !Array.isArray(arr) || !arr.length) {
    return [];
  }
  return arr
    .filter(f => {
      return (typeof f === "string" && f.trim()) || f;
    })
    .reduce((a, c) => a.concat(c), []);
}

function execEqualVal(str) {
  var reg = /[^=]+\=(?<equalVal>\{[^\}]*\}|"[^]*"|'[^']*')/g;
  var result = reg.exec(str);
  // if (str.includes('test="pro看了看ps"')) {
  //   console.log('test="pro看了看ps"');
  //   console.log(str, result);
  // }
  if (!result) {
    return null;
  }
  return result.groups.equalVal.slice(1, -1) || "";
}

function getMatchedStrByReg(
  {
    str,
    recursiveMatchRegArr,
    replaceRegArr,
    replaceStr = "",
    dealMatchedFun,
    isMatchFirst = false
  },
  ...params
) {
  if (!str || !str.length) {
    // !recursiveMatchRegArr.length
    // !recursiveMatchRegArr ||
    return null;
  }
  let value = convertToArr(str) || [];
  recursiveMatchRegArr = convertToArr(recursiveMatchRegArr);
  if (recursiveMatchRegArr && recursiveMatchRegArr.length) {
    value = recursiveMatchRegArr.reduce((a, c) => {
      // reduce match // recursive match
      return a
        .map(s => {
          const r = s.match(c);
          if (r) {
            if (isMatchFirst) {
              return r[0];
            } else {
              return r;
            }
          } else {
            return null;
          }
        })
        .filter(f => f)
        .reduce((a, c) => a.concat(c), []);
    }, value);
  }
  replaceRegArr = convertToArr(replaceRegArr);

  if (replaceRegArr && replaceRegArr.length) {
    replaceRegArr.forEach(reg => {
      // flat replace
      value = value
        .map(ms => {
          if (Object.prototype.toString.call(reg) === "[object RegExp]") {
            return ms.replace(reg, replaceStr || "");
          } else if (Object.prototype.toString.call(reg) == "[object Object]") {
            return ms.replace(reg.reg, reg.replaceStr || replaceStr || "");
          }
        })
        .filter(f => f);
    });
  }

  if (value && dealMatchedFun && typeof dealMatchedFun == "function") {
    value = value.map(s => {
      return dealMatchedFun(s, ...params);
    });
  }
  return (value.length && value) || null;
}

function getRegExpWithTemplateTag() {
  return /(\s*)(?:\<template\>).+?\n\1(?:\<\/template\>)/gs;
}

function getRegExpWithCommentTagForHtml() {
  return /(?:<!--).+?(?:-->)/gs;
}

function getTemplateStr(str, isRemoveComment, isWithoutTpTag = true) {
  var strWithoutScript = str.replace(
    /<script("[^"]*"|'[^']*'|[^'">])*>.*<\/script>/g,
    ""
  ); // 防止script标签内的有template
  var templatevalue = getMatchedStrByReg({
    str: strWithoutScript,
    recursiveMatchRegArr: getRegExpWithTemplateTag(),
    isMatchFirst: true,
    replaceRegArr: isRemoveComment
      ? getRegExpWithCommentTagForHtml()
      : undefined
  });
  var templateStr = (templatevalue && templatevalue[0]) || "";
  if (isWithoutTpTag) {
    templateStr = /(?<=\<template>).+(?=<\/template>)/gs
      .exec(templateStr)[0]
      .trim();
  }
  return templateStr;
}

function getRegExpWithScriptTag(isWithMark) {
  return /(\s*)(\<script('[^']*'|"[^"]*"|[^"'>])*\>)[\s\S]+?\n\1(\<\/script\>)/g;
}

function getRegExpWithCommentForJSX(isWithMark) {
  return /(\{\/\*).*?(\*\/\})/gs;
}

function getRegExpWithCommentForScript(isWithMark, isWithJSX = true) {
  var result = [/\/\/.*/g, /(?:\/\*).+?(?:\*\/)/gs];
  isWithJSX && result.splice(1, 0, getRegExpWithCommentForJSX());
  // log(result);
  return result;
}

function getScriptStr(str, isRemoveComment) {
  var scriptvalue = getMatchedStrByReg({
    str,
    recursiveMatchRegArr: getRegExpWithScriptTag(),
    isMatchFirst: true,
    replaceRegArr: isRemoveComment ? getRegExpWithCommentForScript() : undefined
  });
  return (scriptvalue && scriptvalue[0]) || "";
}

function getTagReg() {
  // isOmitComment=true
  // 去除了注释的tag
  return /<(?!(?:!--|\/))('[^']*'|"[^"]*"|[^'">])*(?<!--)>/g;
}

// function getJsxTagReg() {
//   return /<(?!(?:!--|\/))('[^']*'|"[^"]*"|[^'">])*(?<!--)>/g;
// }

function extractTagStr({ str }) {
  // delimiter < >
  if (!str) {
    return null;
  }

  return str.match(getTagReg());
}

function parseTemplateString(str, isExtracChineseStr) {
  // 模板字符串 用反引号 ``表示
  // outerDelimiter ${}
  // inDelimiter ${}

  var outerExpressionArr = str
    .split(/\$\{[^\}]+?\}/g)
    .filter(f =>
      isExtracChineseStr ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => ({
      value: [s],
      type: "outerExpressionalInTemplateString",
      delimiter: null,
      str: s
    }));

  var innerExpressionArr = str.match(/(?<=\${).+?(?=})/gs) || [];

  if (innerExpressionArr.length) {
    innerExpressionArr = innerExpressionArr
      .filter(f =>
        isExtracChineseStr
          ? isExistChineseStr(f)
            ? f.trim()
            : false
          : f.trim()
      )
      .map(s => {
        let r = extractExpressionStr(s, isExtracChineseStr);
        r && (r.type = "innerExpressionalIntemplateString");
        return r;
      });
  }
  // "fsfs${'无可无不可'}无,可\n 无${'sf$s'+'fsf'}fsfs".match(/((?!\$\{|{).(?<!}))+/gs)
  // ["fsfs", "'无可无不可'", "无,可↵ 无", "'sf$s'+'fsf'", "fsfs"]
  return innerExpressionArr.concat(outerExpressionArr);
}

// function execFunByReg(str, reg) {
//   var result = [];
//   var execObj = null;
//   while ((execObj = reg.exec(str))) {
//     v;
//     result.push();
//   }
// }

function extractExpressionStr(str, isExtracChineseStr) {
  if (isExtracChineseStr && !isExistChineseStr(str)) {
    return null;
  }
  var reg = /(?<=(?<templateString>`))[^`]*(?=\1)|(?<=(?<singleQuotation>'))[^']*(?=\2)|(?<=(?<doubleQuotation>"))[^"]*(?=\3)/g;
  var execObj = null;
  var value = [];
  while ((execObj = reg.exec(str))) {
    let groups = (execObj && execObj.groups) || null;
    let execStr = execObj && execObj[0];

    isExtracChineseStr &&
      isExistChineseStr(execStr) &&
      value.push({
        value:
          groups && groups.templateString
            ? parseTemplateString(execStr, isExtracChineseStr)
            : execStr || "",
        delimiter:
          (groups &&
            (groups.templateString ||
              groups.singleQuotation ||
              groups.doubleQuotation)) ||
          null,
        str: execStr
      });
  }
  return {
    type: "expressional",
    value,
    str
  };
}

// 提取最小中文字符串
function extractMinStr({
  str,
  isExtractChinese = true,
  isExpresstional = true
}) {
  if (!str) {
    return null;
  }
  // isExpresstional 是否逻辑表达式
  // [] {delimiter str}
  var result = [];
  if (isExpresstional) {
    var reg = /\`[^\`]*\`|\'[^\']*\'|\"[^\"]*\"/g;
    // var execObj = reg.exec(str)
    var matchedvalue = str.match(reg);
    if (!matchedvalue) {
      return null;
    }
    return filterAndReduceConcat(
      matchedvalue.map(matchedStr => {
        return extractExpressionStr(matchedStr, true);
      })
    );
  } else {
    return [
      {
        value: [str], //去除 = 号右边 delimiter
        delimiter: null,
        str,
        type: null
      }
    ];
  }
  return result;
}

function getTagPropType(propStr) {
  // 忽略 v-bind="{props: 'fsfs'}" v-on="{event: click('fsf沙发沙发')}"
  // todo 解析v-bind
  var type = "prop";
  (/^:/g.test(propStr) && (type = "bindProp")) ||
    (/^v-bind:/g.test(propStr) && (type = "vBindProp")) ||
    (/^@/g.test(propStr) && (type = "onEvent")) ||
    (/^v-on:/g.test(propStr) && (type = "vOnEvent")) ||
    (/^v-bind\=/g.test(propStr) && (type = "vBindObject")) ||
    (/^v-on\=/g.test(propStr) && (type = "vOnObject"));
  return type;
}

function extractTagProps(propStr, execForChineseStr) {
  // [{type: prop|bindProp|onEvent, str}]
  if (!propStr) {
    return null;
  }

  var type = "prop";
  var value = null;
  var equalVal = execEqualVal(propStr);

  // 忽略 v-bind="{props: 'fsfs'}" v-on="{event: click('fsf沙发沙发')}"

  switch (true) {
    case /^:/g.test(propStr):
      type = "bindProp";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;

    case /^v-bind:/g.test(propStr):
      type = "vBindProp";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;

    case /^@/g.test(propStr):
      type = "onEvent";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;

    case /^v-on:/g.test(propStr):
      type = "vOnEvent";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;

    case /^v-bind\=/g.test(propStr):
      type = "vBindObject";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;

    case /^v-on\=/g.test(propStr):
      type = "vOnObject";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;
    case /}$/g.test(propStr):
      type = "jsxVar";
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal
        }));
      break;
    default:
      execForChineseStr &&
        (value = extractMinStr({
          str: equalVal,
          isExpresstional: false
        }));
      break;
  }
  return {
    type,
    equalVal,
    value,
    str: propStr
  };
}

function parseTagStr({ strArr, isExtractChinese = false, isJsx }) {
  // return Array
  if (!strArr) {
    return null;
  }
  strArr = strArr.map(str => {
    var matchedArr = str.match(
      /(:|@|v-bind:?|v-on:?)?\w*=("[^"]+"|'[^]+'|{[^}]+})/g
    );
    if (!matchedArr) {
      return null;
    }
    return matchedArr.map(matched => {
      return isExtractChinese
        ? isExistChineseStr(matched)
          ? extractTagProps(matched, isExtractChinese)
          : null
        : extractTagProps(matched, isExtractChinese);
    });
  });
  strArr = filterAndReduceConcat(strArr);

  return strArr;
}

function getInnerTextReg() {
  // isOmitComment=true
  return /(?<=<("[^"]*"|'[^']*'|[^'">])*>).+?(?=<("[^"]*"|'[^']*'|[^'">])*>)/gs;
}

function extractInnerTextStr({ str, isTrim = true }) {
  // delimiter <.+?>
  if (!str) {
    return null;
  }
  var result = str.match(getInnerTextReg());
  result = result || [];
  result = result.filter(f => f.trim());
  return isTrim ? result.map(s => s.trim()) : result;
}

function getPlugReg(isOmitDelimiter) {
  if (isOmitDelimiter) {
    return /(?<={{).*?(?=}})/g;
  } else {
    return /{{.*?}}/g;
  }
}

function extractPlugStr({ str, isExtractChinese, delimiter, regFun }) {
  if (!str) {
    return null;
  }
  // delimiter {{}}
  // outerPlug
  // innerPlug

  var outerPlugvalue = str
    .split(regFun())
    .filter(f =>
      isExtractChinese ? (isExistChineseStr(f) ? f : false) : f.trim()
    )
    .map(s => {
      return {
        value: s
          .trim()
          .split(/\r\n/g)
          .filter(f =>
            isExtractChinese ? (isExistChineseStr(f) ? f : false) : f.trim()
          )
          .map(s => s.trim()),
        type: "outerPlug",
        delimiter
      };
    });
  // str;
  // console.log(regFun());
  // outerPlugvalue;
  // console.log(str.split(regFun()));
  var innerPlugvalue = str.match(regFun(true));
  innerPlugvalue =
    innerPlugvalue &&
    innerPlugvalue
      .filter(f =>
        isExtractChinese ? (isExistChineseStr(f) ? f : false) : f.trim()
      )
      .map(i => ({
        value: extractMinStr({ str: i, isExpresstional: true }),
        type: "innerPlug",
        delimiter,
        str: i
      }));
  var result = innerPlugvalue.concat(outerPlugvalue);
  // console.log("result");
  // log(result);
  return (result && result.length && result) || null;
}

function parseInnerTextStr({ strArr, isExtractChinese = false, isJsx }) {
  // 去除 \s 字符串
  strArr = strArr.map(s => {
    if (isExtractChinese && !isExistChineseStr(s)) {
      return null;
    }

    var delimiter = {
      start: isJsx ? "{" : "{{",
      end: isJsx ? "}" : "}}"
    };
    var regFun = getPlugRegFunByDelimiter({ delimiter });
    // console.log(regFun());
    // if (getPlugReg().test(s)) {
    if (regFun().test(s)) {
      return extractPlugStr({
        str: s,
        isExtractChinese,
        regFun,
        delimiter
      });
    }

    return { value: s.trim(), type: null, str: s.trim() }; // extractFrom: "betweenHtmlTag"
  });
  return strArr.filter(f => f).reduce((a, c) => a.concat(c), []);
}

function getVueTemplateStrs({ str, isExtractChinese = false, isJsx = false }) {
  var innerText = parseInnerTextStr({
    strArr: extractInnerTextStr({ str }),
    isExtractChinese,
    isJsx
  });
  innerText = innerText && innerText;
  return {
    innerText,
    tag: parseTagStr({
      strArr: extractTagStr({ str }),
      isExtractChinese,
      isJsx
    })
  };
  // var cpObj = compiler.compile(str);
  // log(cpObj);
  // return cpObj;
}

function getScriptJsxReg() {
  var reg = /(?<=\(\s*)<(\w+)('[^']*'|"[^"]*"|[^'"\>])*>[\S\s]*?<\/\1>(?=\s*\))|<(\w+)('[^'\r\n]*'|"[^"\r\n]*"|[^'"\>\r\n])*\/?>[^\r\n]*(<\/\1>)?/g;
  return reg;
}

// function getScriptJsxCommentReg() {}

function extractJsxStr(str) {
  // todo 排除jsx注释中的字符串 delimiter {/*\n  \n*/}
  // 去除script
  var MatchedStr = /(?<=\s*<(script)('[^']*'|"[^"]*"|[^'">])*>)[\s\S]*(?=\s*<\/\1>)/g.exec(
    str
  );
  str = (MatchedStr && MatchedStr[0]) || "";
  // 匹配多行jsx , 或者单行jsx
  var reg = getScriptJsxReg();
  var matchArr = [];
  var match = "";
  while ((match = reg.exec(str))) {
    matchArr.push(match[0]);
  }
  return matchArr;
}

function addSlash(str) {
  return (
    (str &&
      str
        .split("")
        .reduce((a, c) => a.concat(["\\", c]), [])
        .join("")) ||
    str
  );
}

function getPlugRegFunByDelimiter({ delimiter, regExpOptions }) {
  return function(exIncludeDelimiter) {
    return getPlugRegByDelimiter({
      delimiter,
      exIncludeDelimiter,
      regExpOptions
    });
  };
}

// todo 提取指定delimiter 中的内容， 是否包含delimiter
function getPlugRegByDelimiter({
  delimiter,
  isMatchStrGreedy = false,
  exIncludeDelimiter = false,
  regExpOptions = "gs"
}) {
  // delimiter.start
  // delimiter.end
  var start = (delimiter && delimiter.start) || delimiter || "";
  start = addSlash(start);

  var end = (delimiter && delimiter.end) || delimiter || "";
  end = addSlash(end);

  var regStr = `${start}('[^']*'|"[^"]*"|\`[^\`]*\`|[^\'\"\`${end}])*${
    isMatchStrGreedy ? "" : "?"
  }${end}`;
  if (exIncludeDelimiter) {
    start &&
      (regStr = regStr.replace(
        new RegExp("^" + addSlash(start), "g"),
        `(?<=${start})`
      ));
    end &&
      (regStr = regStr.replace(
        new RegExp(addSlash(end) + "$", "g"),
        `(?=${end})`
      ));
  }
  // console.log(regStr);
  let result = new RegExp(regStr, regExpOptions);
  return result;
}

function getTagPropsReg() {
  return `\('\[\^'\]\*'\|"\[\^"\]\*"\|\[\^'"\\\>\]\)\*`;
}

function parseJsxStr({ strArr, isExtractChinese }) {
  // if (isExtractChinese && !isExistChineseStr(str)) {
  //   return null;
  // }
  strArr = strArr
    .filter(f =>
      isExtractChinese ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => {
      // type in inDelimiter outDelimiter
      return s;
    });

  return {
    value: strArr.map(str =>
      getVueTemplateStrs({ str, isExtractChinese, isJsx: true })
    ),
    type: "jsx"
  };
}

function extractVarStr(str, withoutJSX = true) {
  var s = str.replace(getScriptJsxReg(), "");
  var result = [];
  var reg = /`[^`]*`|"[^"]*"|'[^']*'/g;
  var match = null;
  while ((match = reg.exec(s))) {
    result.push(match[0]);
  }
  // console.log(result);
  return result;
}

function parseScriptStr({ strArr, isExtractChinese }) {
  strArr = strArr
    .filter(f =>
      isExtractChinese ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => s);
  return {
    value: strArr.map(str => extractMinStr({ str, isExpresstional: true })),
    type: "varStr"
  };
}

function extractVnodeStr(str) {
  return null;
}

function parseVnodeStr(strArr, isExtractChinese) {
  return null;
}

function getVueScriptStrs({ str, isExtractChinese = false }) {
  var filterStr = getMatchedStrByReg({
    str,
    replaceRegArr: getRegExpWithCommentForScript()
  });
  // log(filterStr[0]);
  //  props 中的中文字符串改写成i18n的写法无法转换中英文，this无法读取到实例
  return {
    jsxStr: parseJsxStr({
      strArr: extractJsxStr(filterStr[0]),
      isExtractChinese
    }),
    varStr: parseScriptStr({
      strArr: extractVarStr(filterStr[0]),
      isExtractChinese
    })
    // vnodeStr: parseVnodeStr(extractVnodeStr(str), isExtractChinese), // render function, $createElement, h()
    // propsStr:
  };
}

// const jsdom = require("jsdom");
// const { JSDOM } = jsdom;

// var xml2js = require("xml2js");
// // var xml = '<foo></foo>';

// function parseXml(xml) {
//   // With parser
//   var parser = new xml2js.Parser();
//   parser
//     .parseStringPromise(xml)
//     .then(function(result) {
//       console.dir(result);
//       console.log("Done");
//     })
//     .catch(function(err) {
//       console.log(err);
//       // Failed
//     });

//   // Without parser
//   xml2js
//     .parseStringPromise(xml /*, options */)
//     .then(function(result) {
//       console.dir(result);
//       console.log("Done");
//     })
//     .catch(function(err) {
//       // Failed
//     });
// }

function extractStrForVue({ str, type, file, isExtractChinese }) {
  var templateStr = getTemplateStr(str);
  var scriptStr = getScriptStr(str);

  var result = {
    template: getVueTemplateStrs({ str: templateStr, isExtractChinese }),
    script: getVueScriptStrs({ str: scriptStr, isExtractChinese }),
    type,
    file
  };
  return result;
}

function extractStr({ str, type, file, isExtractChinese = false }) {
  if (type == ".vue") {
    return extractStrForVue({ str, type, file, isExtractChinese });
  }
  return null;
}

async function scan({
  p,
  options = {},
  outPutDir,
  includes,
  excludes,
  isExtractChinese = false
}) {
  // options: {matchBase:true}
  var files = glob.sync(p, options);

  var result = await Promise.all(
    files.map(async file => {
      const str = String(await readFile(file));
      log(file);
      return extractStr({
        str,
        type: path.extname(file),
        file,
        isExtractChinese
      });
    })
  );

  // 去除假值，合并数组
  result = result.filter(f => f).reduce((a, c) => a.concat(c), []);
  // log(result);
  return result;
}

function isObj(obj) {
  return Object.prototype.toString.call(obj) == "[object Object]";
}
const lodash = require("lodash");
function flatArr(obj, prop = "value") {
  // log(obj);
  if (!obj || (Array.isArray(obj) && !obj.length)) {
    return null;
  }
  // if (obj && typeof obj == "string") {
  //   return obj;
  // }
  if (isObj(obj)) {
    if (Object.hasOwnProperty("value")) {
      if (typeof obj.value == "string") {
        return obj.value;
      }
      if (isObj(obj.value)) {
        // console.log("obj.value is obj");
        return "obj.value is obj";
      }
      if (Array.isArray(obj.value)) {
        return flatArr(obj.value);
      }
    } else {
      let result = [];
      for (let [key, value] of Object.entries(obj)) {
        // console.log([key, value]); // ['a', 1], ['b', 2], ['c', 3]
        let isPush = [
          "template",
          "script",
          "innerText",
          "tag",
          "jsxStr",
          "varStr",
          "value"
        ].includes(key);
        // isPush &&
        value && result.push(flatArr(value));
      }
      return result;
    }
  }
  if (Array.isArray(obj)) {
    return obj
      .map(o => {
        // console.log("fs");
        if (!o) {
          return null;
        }
        if (typeof o == "string") {
          return o;
        }
        if (typeof o.value == "string") {
          return o.value;
        }
        if (Array.isArray(o.value) && o.length) {
          return flatArr(o.value);
        }
        let r = flatArr(o);
        if (Array.isArray) {
          return r.filter(f => f).reduce((a, c) => a.concat(c), []);
        }
        return r;
      })
      .filter(f => f)
      .reduce((a, c) => a.concat(c), []);
  }
  return null;
  // return Object.prototype.toString(obj);
  // return obj;
}

async function extractStrFromFile(params) {
  var filesObj = await scan(params);
  console.log("------------------------");
  log(lodash.flattenDeep(flatArr(filesObj)).filter(f => f));
  // console.log("fsf");
  console.log("---------------");
  log(filesObj);
}

extractStrFromFile({
  p: resolve(__dirname, "./test.vue"),
  isExtractChinese: true
});

// export const onRE = /^@|^v-on:/
// export const dirRE = process.env.VBIND_PROP_SHORTHAND
//   ? /^v-|^@|^:|^\.|^#/
//   : /^v-|^@|^:|^#/
// export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
// export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
// const stripParensRE = /^\(|\)$/g
// const dynamicArgRE = /^\[.*\]$/
// const argRE = /:(.*)$/
// export const bindRE = /^:|^\.|^v-bind:/
// const propBindRE = /^\./
// const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g
// const slotRE = /^v-slot(:|$)|^#/
// const lineBreakRE = /[\r\n]/
// const whitespaceRE = /\s+/g
// const invalidAttributeRE = /[\s"'<>\/=]/

// html
// const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
// const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// const startTagOpen = new RegExp(`^<${qnameCapture}`)
// const startTagClose = /^\s*(\/?)>/
// const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// const doctype = /^<!DOCTYPE [^>]+>/i
// const comment = /^<!\--/
// const conditionalComment = /^<!\[/

// todo 后期采用vue htmlparse codegen 解析string , 生成 code .
