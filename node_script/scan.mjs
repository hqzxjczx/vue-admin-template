// const vue = require("vue");

// const compiler = require("vue-template-compiler");
// const jsxParse = require("jsx-parser");

// console.log(jsxParse);
// const acorn = require("acorn");
// const jsx = require("acorn-jsx");
// var acorn = require("acorn");

// var acorn = require("acorn-jsx");
// console.log(acorn);
// var isExprssion = require("is-expression");
// todo jsx 解析使用 babel-vue-jsx 相关脚本

// const jsxParse = acorn.parse;
// const jsxParse = acorn.Parser.extend(jsx({ allowNamespaces: false }));

// import { createRequire } from "module";
// const require = createRequire(import.meta.url);

const jsxParse = require("jsx-parser").default;
const sha256 = require("crypto-js/sha256");

const compiler = require("vue-template-compiler");
const { promisify, inspect } = require("util");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const { resolve } = path;

// writeFile(resolve(__dirname, "./writeFile.txt"), "writeFile")
//   .then(res => {
//     console.log(res);
//   })
//   .catch(e => {
//     console.log(e);
//   });

function log(obj, options) {
  let defaultOptions = {
    showHidden: false,
    depth: null
  };
  options &&
    ((typeof options == "string" && console.log(options)) ||
      (typeof options == "object" &&
        (defaultOptios = Object.assign(defaultOptions, options)) &&
        defaultOptions.desc &&
        console.log(defaultOptions.desc)));
  console.log(inspect(obj, defaultOptions));
}

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
    return null;
  }
  let value = convertToArr(str) || [];
  recursiveMatchRegArr = convertToArr(recursiveMatchRegArr);
  if (recursiveMatchRegArr && recursiveMatchRegArr.length) {
    value = recursiveMatchRegArr.reduce((a, c) => {
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
// 有风险， 最好采用逐行读取确定<template>.+?</template>的范围，同理<script>也一样</script>
function getRegExpWithTemplateTag() {
  return /(?<=(\s*))<template>.+?\1<\/template>/gs;
}

function getRegExpWithCommentTagForHtml() {
  return /(?:<!--).+?(?:-->)/gs;
}

function getTemplateStr(str, isRemoveComment, isWithoutTpTag = true) {
  var strWithoutScript = str.replace(
    /(?<=(\r\n))<script("[^"]*"|'[^']*'|[^'">])*>.*?\1<\/script>/g,
    ""
  );
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
  // return /(\s*)(\<script('[^']*'|"[^"]*"|[^"'>])*\>)[\s\S]+?\n\1(\<\/script\>)/g;
  return /(?<=(\r\n))(\<script('[^']*'|"[^"]*"|[^"'>])*\>)[\s\S]+?\1<\/script\>/g;
}

function getRegExpWithCommentForJSX(isWithMark) {
  return /(\{\/\*).*?(\*\/\})/gs;
}

function getRegExpWithCommentForScript(isWithMark, isWithJSX = true) {
  var result = [/\/\/.*/g, /(?:\/\*).+?(?:\*\/)/gs];
  isWithJSX && result.splice(1, 0, getRegExpWithCommentForJSX());

  return result;
}

function getScriptStr(str, isRemoveComment) {
  var scriptvalue = getMatchedStrByReg({
    str,
    recursiveMatchRegArr: getRegExpWithScriptTag(),
    isMatchFirst: true,
    replaceRegArr: isRemoveComment ? getRegExpWithCommentForScript() : undefined
  });
  // console.log(str);
  // console.log(scriptvalue);
  return (scriptvalue && scriptvalue[0]) || "";
}

function getTagReg() {
  return /<(?!(?:!--|\/))('[^']*'|"[^"]*"|[^'">])*(?<!--)>/g;
}

function extractTagStr({ str }) {
  if (!str) {
    return null;
  }

  return str.match(getTagReg());
}

function parseTemplateString(str, isExtracChineseStr) {
  var outerExpressionArr = str
    .split(/\$\{[^\}]+?\}/g)
    .filter(f =>
      isExtracChineseStr ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => ({
      value: s
        .trim()
        .split(/\r\n/)
        .map(s => s.trim()),
      // value: [s],
      type: "outerExpressionalInTemplateString",
      delimiter: null,
      str: s
    }));

  var innerExpressionArr = str.match(/(?<=\${).*?(?=})/gs) || [];
  // str.match(/(?<=\${)(`[^`]*`|"[^"]*"|'[^']*'|[^`'"}])*(?=})/gs) || [];
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

  return innerExpressionArr.concat(outerExpressionArr);
}

function extractExpressionStr(str, isExtracChineseStr) {
  if (isExtracChineseStr && !isExistChineseStr(str)) {
    return null;
  }
  var reg = /(?<=(?<templateString>`))[^`]*?(?=\1)|(?<=(?<singleQuotation>'))[^']*?(?=\2)|(?<=(?<doubleQuotation>"))[^"]*?(?=\3)/g;
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

function extractMinStr({
  str,
  isExtractChinese = true,
  isExpresstional = true
}) {
  if (!str) {
    return [];
  }

  if (isExpresstional) {
    var reg = /`[^`]*?`|'[^']*?'|"[^"]*?"/g;

    var matchedvalue = str.match(reg);
    if (!matchedvalue) {
      return [];
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
}

function getTagPropType(propStr) {
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
  if (!propStr) {
    return null;
  }

  var type = "prop";
  var value = null;
  var equalVal = execEqualVal(propStr);

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
  return /(?<=<("[^"]*"|'[^']*'|[^'">])*>).+?(?=<("[^"]*"|'[^']*'|[^'">])*>)/gs;
}

function extractInnerTextStr({ str, isTrim = true }) {
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

  var innerPlugvalue = str.match(regFun(true));
  innerPlugvalue =
    innerPlugvalue &&
    innerPlugvalue
      .filter(f =>
        isExtractChinese ? (isExistChineseStr(f) ? f : false) : f.trim()
      )
      .map(i => ({
        value: extractMinStr({
          str: i,
          isExpresstional: true
        }),
        type: "innerPlug",
        delimiter,
        str: i
      }));
  var result = innerPlugvalue.concat(outerPlugvalue);

  return (result && result.length && result) || null;
}

function parseInnerTextStr({ strArr, isExtractChinese = false, isJsx }) {
  strArr = strArr.map(s => {
    if (isExtractChinese && !isExistChineseStr(s)) {
      return null;
    }

    var delimiter = {
      start: isJsx ? "{" : "{{",
      end: isJsx ? "}" : "}}"
    };
    var regFun = getPlugRegFunByDelimiter({
      delimiter
    });

    if (regFun().test(s)) {
      return extractPlugStr({
        str: s,
        isExtractChinese,
        regFun,
        delimiter
      });
    }

    return {
      value: s.trim(),
      type: null,
      str: s.trim()
    };
  });
  return strArr.filter(f => f).reduce((a, c) => a.concat(c), []);
}

function getVueTemplateStrs({ str, isExtractChinese = false, isJsx = false }) {
  var innerText = parseInnerTextStr({
    strArr: extractInnerTextStr({
      str
    }),
    isExtractChinese,
    isJsx
  });
  innerText = innerText && innerText;
  return {
    innerText,
    tag: parseTagStr({
      strArr: extractTagStr({
        str
      }),
      isExtractChinese,
      isJsx
    })
  };
  // var cpObj = compiler.compile(str);
  // return cpObj.ast;
}

function getScriptJsxReg() {
  var reg = /(?<=\(\s*)<(\w+)('[^']*'|"[^"]*"|[^'"\>])*>[\S\s]*?<\/\1>(?=\s*\))|<(\w+)('[^'\r\n]*'|"[^"\r\n]*"|[^'"\>\r\n])*\/?>[^\r\n]*(<\/\1>)?/g;
  return reg;
}

function extractJsxStr(str) {
  var MatchedStr = /(?<=\s*<(script)('[^']*'|"[^"]*"|[^'">])*>)[\s\S]*(?=\s*<\/\1>)/g.exec(
    str
  );
  str = (MatchedStr && MatchedStr[0]) || "";

  var reg = getScriptJsxReg();
  var matchArr = [];
  var match = "";
  while ((match = reg.exec(str))) {
    matchArr.push(match[0]);
  }
  return matchArr;
}

function addSlash(str) {
  // return (
  //   (str &&
  //     str
  //       .split("")
  //       .reduce((a, c) => a.concat(["\\", c]), [])
  //       .join("")) ||
  //   str
  // );
  return str.replace(/\W/g, "\\$&");
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

function getPlugRegByDelimiter({
  delimiter,
  isMatchStrGreedy = false,
  exIncludeDelimiter = false,
  regExpOptions = "gs"
}) {
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

  let result = new RegExp(regStr, regExpOptions);
  return result;
}

function getTagPropsReg() {
  return `\('\[\^'\]\*'\|"\[\^"\]\*"\|\[\^'"\\\>\]\)\*`;
}

function parseJsxStr({ strArr, isExtractChinese }) {
  strArr = strArr
    .filter(f =>
      isExtractChinese ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => {
      return s;
    });

  return {
    value: strArr.map(str => {
      // console.log(str);
      var result = jsxParse(str);
      result.sourceStr = str;
      return result;
      // return getVueTemplateStrs({ str, isExtractChinese, isJsx: true });
    }),
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

  return result;
}

function parseScriptStr({ strArr, isExtractChinese }) {
  // console.log("parseScriptStr", strArr);
  strArr = strArr
    .filter(f =>
      isExtractChinese ? (isExistChineseStr(f) ? f.trim() : false) : f.trim()
    )
    .map(s => s);
  return {
    value: strArr.map(str =>
      extractMinStr({
        str,
        isExpresstional: true
      })
    ),
    type: "varStr"
  };
}

function extractVnodeStr(str) {
  return null;
}

function parseVnodeStr(strArr, isExtractChinese) {
  return null;
}

function getScriptStrsObj({ str, isExtractChinese = false, isVueStr }) {
  // todo 如果是.vue文件 是否需要处理 script与export default 之间存在中文字符串等情况
  //暂无处理
  var filterStr = getMatchedStrByReg({
    str,
    replaceRegArr: getRegExpWithCommentForScript()
  });

  var r = {
    jsxStr: parseJsxStr({
      strArr: extractJsxStr(filterStr[0]),
      isExtractChinese
    }),
    varStr: parseScriptStr({
      strArr: extractVarStr(filterStr[0]),
      isExtractChinese
    })
  };
  return r;
}

function getVueTemplateAST({ str, isExtractChinese }) {
  return compiler.compile(str).ast;
}

function extractStrForVue({ str, type, file, isExtractChinese }) {
  var templateStr = getTemplateStr(str);
  var scriptStr = getScriptStr(str);

  var result = {
    // template: getVueTemplateStrs({ str: templateStr, isExtractChinese }),
    template: getVueTemplateAST({
      str: templateStr,
      isExtractChinese
    }),
    script: getScriptStrsObj({
      str: scriptStr,
      isExtractChinese,
      isVueStr: true
    }),
    type,
    file
  };
  // console.log(result);
  return result;
}

function extractStrForJs({ str, type, file, isExtractChinese }) {
  var result = {
    script: getScriptStrsObj({
      str: str,
      isExtractChinese
    }),
    type,
    file
  };
  return result;
}

function extractStr({ str, type, file, isExtractChinese = false }) {
  if (type == ".vue") {
    return extractStrForVue({
      str,
      type,
      file,
      isExtractChinese
    });
  }
  if (type == ".js") {
    return extractStrForJs({
      str,
      type,
      file,
      isExtractChinese
    });
  }

  return null;
}

async function scan({ p, options = {}, isExtractChinese = false }) {
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

  result = result.filter(f => f).reduce((a, c) => a.concat(c), []);
  return result;
}

function isObj(obj) {
  return Object.prototype.toString.call(obj) == "[object Object]";
}
const lodash = require("lodash");
// todo flatArr 改为 flatMap 实现
function flatArr(obj, prop = "value") {
  if (!obj || (Array.isArray(obj) && !obj.length)) {
    return null;
  }

  if (isObj(obj)) {
    if (Object.hasOwnProperty("value")) {
      if (typeof obj.value == "string") {
        return obj.value;
      }
      if (isObj(obj.value)) {
        return "obj.value is obj";
      }
      if (Array.isArray(obj.value)) {
        return flatArr(obj.value);
      }
    } else {
      let result = [];
      for (let [key, value] of Object.entries(obj)) {
        let isPush = [
          "template",
          "script",
          "innerText",
          "tag",
          "jsxStr",
          "varStr",
          "value"
        ].includes(key);

        isPush && value && result.push(flatArr(value));
      }
      return result;
    }
  }
  if (Array.isArray(obj)) {
    return obj
      .map(o => {
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
}
const isEmpty = lodash.isEmpty;

function getChineseStrBoolean({ str, isExtractChinese, isTrim = true }) {
  return isExtractChinese
    ? isExistChineseStr(str)
      ? !!str.trim()
      : false
    : !!str.trim();
}

function extractStrsFromHtmlParseObj(obj, isExtractChinese) {
  if (isEmpty(obj)) {
    return [];
  }
  // type: 1,
  // tag: 'div',
  // attrsMap: {},
  // children

  const TAG_NODE = 1; // attrsMap
  const TEX_EXP_NODE = 2; // static: false, text
  const TEXT_STATIC_NODE = 3; // static: true, text

  switch (obj.type) {
    case TAG_NODE:
      if (isEmpty(obj.attrsMap) && isEmpty(obj.children)) {
        return [];
      }
      // log(obj);
      var attrs = [];
      if (!isEmpty(obj.attrsMap)) {
        attrs = Object.entries(obj.attrsMap)
          .filter(([key, str]) =>
            getChineseStrBoolean({
              str,
              isExtractChinese
            })
          )
          .map(([key, val]) => {
            if (/^v-|^@|^:|^\.|^#/.test(key)) {
              var r = flatArr(
                extractMinStr({
                  str: val.trim(),
                  isExtractChinese
                })
              );
              if (val.includes("fsoo舒服舒服f")) {
                console.log("fsoo舒服舒服f", r);
              }
              return r;
            }
            return val.trim();
          })
          .flat();
      }
      // fs地方
      var children = [];
      if (!isEmpty(obj.children)) {
        children = obj.children
          .map(child => {
            return extractStrsFromHtmlParseObj(child, isExtractChinese);
          })
          .filter(f => !isEmpty(f))
          .reduce((a, c) => a.concat(c), []);
      }
      // return lodash.flattenDeep(attrs.concat(children));
      return attrs.concat(children);
    case TEX_EXP_NODE:
      return obj.tokens
        .filter(f => {
          if (lodash.isString(f)) {
            return getChineseStrBoolean({
              str: f,
              isExtractChinese
            });
          }
          if (lodash.isObject(f)) {
            return getChineseStrBoolean({
              str: f["@binding"],
              isExtractChinese
            });
          }
        })
        .map(s => {
          if (lodash.isString(s)) {
            return s
              .split(/\r\n/)
              .filter(f => getChineseStrBoolean({ str: f, isExtractChinese }))
              .map(s => s.trim());
          }
          if (lodash.isObject(s)) {
            // return s["@binding"].trim();
            var r = flatArr(
              extractMinStr({
                str: s["@binding"].trim(),
                isExtractChinese
              })
            );
            return r;
          }
        })
        .flat();
    case TEXT_STATIC_NODE:
      return obj.text
        .split(/\r\n/)
        .filter(f => getChineseStrBoolean({ str: f, isExtractChinese }))
        .map(s => s.trim());
    default:
      break;
  }

  return [];
}

function extractStrsFromJsxParseObj(obj, isExtractChinese) {
  // log(obj);
  if (isEmpty(obj)) {
    return [];
  }
  /* 
  type -- tag | #text #jsx
  props //[string, {type: jsx, nodeValue}]
  children
   */
  switch (true) {
    case /^\w/g.test(obj.type):
      var props = [];
      if (!isEmpty(obj.props)) {
        props = Object.values(obj.props)
          .filter(f => {
            if (lodash.isString(f)) {
              return getChineseStrBoolean({
                str: f,
                isExtractChinese
              });
            }
            if (lodash.isObject(f)) {
              return getChineseStrBoolean({
                str: f.nodeValue,
                isExtractChinese
              });
            }
          })
          .map(o => {
            if (lodash.isString(o)) {
              return o.trim();
            }
            if (lodash.isObject(o)) {
              var r = flatArr(
                extractMinStr({
                  str: o.nodeValue.trim(),
                  isExtractChinese
                })
              );
              return r;
            }
          })
          .flat();
      }
      var children = [];
      if (!isEmpty(obj.children)) {
        children = obj.children
          .map(child => extractStrsFromJsxParseObj(child, isExtractChinese))
          .filter(f => f)
          .flat();
      }
      // log(obj);
      var r = props.concat(children).filter(f => f);
      return r;
    case /^#jsx/g.test(obj.type):
      return flatArr(
        extractMinStr({
          str: obj.nodeValue.trim(),
          isExtractChinese
        })
      ).filter(f =>
        getChineseStrBoolean({
          str: f,
          isExtractChinese
        })
      );
    case /^#text/g.test(obj.type):
      var nodeValue = obj.nodeValue
        .trim()
        .split(/\r\n/)
        .filter(f =>
          isExtractChinese
            ? isExistChineseStr(f)
              ? f.trim()
              : false
            : f.trim()
        )
        .map(s => s.trim());
      return nodeValue;
    default:
      break;
  }

  return null;
}

function extractStrsFromVarObj(obj, isExtractChinese) {
  return flatArr(obj)
    .flat(Infinity)
    .filter(f => f);
}

function extractStrForFileAstObj({ fileObj, isExtractChinese }) {
  // log(fileObj)
  var tpArr = extractStrsFromHtmlParseObj(fileObj.template, isExtractChinese);

  var jsxValArr = fileObj.script.jsxStr.value;
  var jsxArr =
    (isEmpty(jsxValArr) && []) ||
    jsxValArr
      .map(jsxobj => extractStrsFromJsxParseObj(jsxobj, isExtractChinese))
      .filter(f => !isEmpty(f))
      .flat();
  var jsVarValArr = fileObj.script.varStr.value;
  var jsVarArr =
    (isEmpty(jsVarValArr) && []) ||
    jsVarValArr
      .map(varObj => extractStrsFromVarObj(varObj, isExtractChinese))
      .filter(f => !isEmpty(f))
      .flat();

  var result = Array.from(new Set([].concat(tpArr, jsxArr, jsVarArr))).filter(
    f => !isEmpty(f)
  );

  // console.log(tpArr, jsxArr, jsVarArr);
  // log(fileObj);
  // log(result);
  // return result;
  return {
    textArr: result,
    file: fileObj
  };
}

async function extractStrOfFiles(params) {
  var fileObjArr = await scan(params);
  console.log("------------------------");
  var isExtractChinese = params.isExtractChinese;
  var result = fileObjArr
    .map(fileObj => {
      let r = extractStrForFileAstObj({ fileObj, isExtractChinese });
      return (r && r.textArr) || [];
    })
    .flat();
  // log(result);
  console.log("---------------");
  return result;
}

// todo 后期采用vue htmlparse codegen 解析string , 生成 code。生成的code是为vue使用的，
// 故而后面可考虑是否把此功能做成为一个vue,webpack插件

// outPutDir,includes,excludes,

async function readExistJsonFile({ p, options = {} }) {
  var files = glob.sync(p, options);

  var keyMap = new Map();
  // var keySet = new Set();
  // 以中文字段为Map的key, {zhStr: '中文字符',enStr: '英文', key: '唯一关键字符' }
  await Promise.all(
    files.map(async file => {
      var data = await readFile(file);
      try {
        var dataObj = JSON.parse(data);
        // file;
        // dataObj;
        if (/zh/.test(path.basename(file))) {
          Object.entries(dataObj).forEach(([k, v]) => {
            if (v && lodash.isString(v)) {
              var obj =
                (keyMap.has(k) && keyMap.get(k)) ||
                keyMap
                  .set(k, {
                    key: k,
                    zhStr: v
                  })
                  .get(k);
              !obj.zhStr && (obj.zhStr = v);
            }
          });
        }
        if (/en/.test(path.basename(file))) {
          Object.entries(dataObj).forEach(([k, v]) => {
            if (v && lodash.isString(v)) {
              var obj =
                (keyMap.has(k) && keyMap.get(k)) ||
                keyMap
                  .set(k, {
                    key: k,
                    enStr: v
                  })
                  .get(k);
              !obj.enStr && (obj.enStr = v);
            }
          });
        }
        return dataObj;
      } catch (e) {
        console.error(e);
        return null;
      }
    })
  );
  // 转换为字典
  // log(path);

  var zhStrMap = new Map();
  [...keyMap.entries()].forEach(([k, v]) => {
    zhStrMap.set(v.zhStr, v);
  });
  return {
    keyMap,
    zhStrMap
  };
}

// extractStrOfFiles({
//   p: resolve(__dirname, "./test.vue"),
//   isExtractChinese: true
// });

// readExistJsonFile({
//   p: resolve(__dirname, "../src/local/**/*.json")
// });
function getExcludeCommentRegForVue() {
  return /(<i18n>.*?<\/i18n>)|<style[^>]*>.*?<\/style>|<\!--.*?-->|{\/\*.*?\*\/}|\/\*.*?\*\/|\/\/[^\r\n]*/gs;
}
async function isExistChForFiles({ p, options }) {
  var files = glob.sync(p);
  var result = await Promise.all(
    files.map(async file => {
      var str = String(await readFile(file));
      var tpStr = str.replace(getExcludeCommentRegForVue(), ""); // 去除style i18n标签
      var isExist = isExistChineseStr(tpStr);
      if (isExist) {
        return {
          isExist,
          file
        };
      }
      return null;
    })
  );
  // console.log(result);
  return result.filter(f => f);
}

function getUnicKey({ str, keyMap }) {
  if (!keyMap.has(str)) {
    return str;
  } else {
    var rpStr = str;
    while (keyMap.has(rpStr)) {
      rpStr = str + parseInt(Math.random() * 1000000);
    }
    return rpStr;
  }
}
// console.log(isExistChForFiles({ p: resolve(__dirname, "./test.vue") }));
function getKeyByStr({ str, keyMap, count = 4, len = 2 }) {
  var wordsStr = str.trim();
  var wordsStrArr = wordsStr.split(/\s*/g);
  var wordCount = wordsStrArr.length;
  var r = wordsStr;
  switch (true) {
    case wordCount.lenth < count:
      return getUnicKey({ str, keyMap });
    case wordCount.lenth >= count:
      r = wordsStrArr.map(s => s.slice(0, len)).join("");
      return getUnicKey({ str, keyMap });
    default:
      return getUnicKey({ str, keyMap });
      break;
  }
}

function setKeyForWordString({ enStr, zhStr, keyMap, zhStrMap }) {
  if (!enStr.trim()) {
    return;
  }
  var k = getKeyByStr({ str: enStr, keyMap });
  keyMap.set(k, k);
  zhStrMap.set(zhStr, {
    key: k,
    zhStr,
    enStr
  });
}

async function requestForTranslateByStr({ str }) {
  return Promise.resolve({ str } || null);
}

async function translateWords({
  strArr,
  zhStrMap,
  keyMap,
  delimiter = { start: "{{", end: "}}" },
  isUpper = true
}) {
  var strArrWithDelimiter = strArr.map(
    s => `${delimiter.start}${s}${delimiter.end}`
  );
  var strsWithDelimiter = strArrWithDelimiter.join("");
  console.log(strsWithDelimiter);
  var result = await requestForTranslateByStr({ str: strsWithDelimiter });
  if (result && result.str) {
    var translatedStrArr = result.str.match(/(?<={{).*?(?=}})/g);
    translatedStrArr.forEach((s, index) => {
      var enStr = s.replace(/(?<=\s*)\w/, s => s.toUpperCase());
      var zhStr = strArr[index];
      setKeyForWordString({ enStr, zhStr, keyMap, zhStrMap });
    });
  }
  console.log(zhStrMap);
  return zhStrMap;
}

function outStringToJson({ dir, fileNameList, map }) {
  var zhJson = {};
  var enJson = {};
  Array.from(map.values()).forEach(o => {
    zhJson[o.key] = o.zhStr;
    enJson[o.key] = o.enStr;
  });
  var zhFileName = "i18n_common_zh.json";
  var enFileName = "i18n_common_eh.json";
  if (Array.isArray(fileNameList) && fileNameList.length) {
    fileNameList.forEach(f => {
      if (f.includes("zh")) {
        zhFileName = f;
        console.log();
        writeFile(path.resolve(dir, zhFileName), JSON.stringify(zhJson)).then(
          res => {
            console.log(res);
          }
        ).catch(e){
          console.log(e)
        };
      }
      if (/en/g.test(f)) {
        enFileName = f;
        writeFile(path.resolve(dir, enFileName), JSON.stringify(enJson)).then(
          res => {
            console.log(res);
          }
        ).catch(e){
          console.log(e)
        };
      }
    });
  }
}

async function setTranslateMap({
  file,
  json,
  outPut = {
    dir: resolve(__dirname, "./"),
    fileNameList: ["i18n_common_zh.json", "i18n_common_en.json"]
  },
  isExtractChinese = true
}) {
  // file.p options
  // json.p options
  //   outPutDir,includes,excludes,isExtractChinese = false
  var [strArr, { keyMap, zhStrMap }] = await Promise.all([
    extractStrOfFiles({ ...file, isExtractChinese }),
    readExistJsonFile(json)
  ]);
  if (!isEmpty(strArr)) {
    // strArr 待翻译的中文字符串数组
    // zhStrMap 已有翻译的对应的中文
    // console.log(dir, fileNameList);
    var filterArr = strArr.filter(s => zhStrMap.has(s));
    var totalZhStrMap = await translateWords({
      strArr: filterArr,
      zhStrMap,
      keyMap
    });
  }
  var { dir, fileNameList } = outPut;
  outStringToJson({ dir, fileNameList, map: zhStrMap });
  return zhStrMap;
}

// setTranslateMap({
//   file: { p: resolve(__dirname, "./test.vue") },
//   json: { p: resolve(__dirname, "../src/local/**/*.json") },
//   isExtractChinese: true
// });

function requestForTranslate(strArr) {
  // delimiter {{ }}
  strArr = strArr.map(str => {
    return `{{${str}}}`;
  });
  str = strArr.join("");
  console.log(str);
}

const readline = require("readline");

async function processLineByLine() {
  const fileStream = fs.createReadStream(path.resolve(__dirname, "./test.vue"));

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // 注意：我们使用 crlfDelay 选项将 input.txt 中的所有 CR LF 实例（'\r\n'）识别为单个换行符。
  var text = "";
  for await (const line of rl) {
    // input.txt 中的每一行在这里将会被连续地用作 `line`。
    // console.log(`Line from file: ${line}`);
    text += line;
  }
  console.log(text);
}

// processLineByLine();

function getReplaceExpVal({
  mark,
  varMark,
  val,
  translateMap,
  translateMark,
  isExtractChinese
}) {
  var matched = null;
  var reg = /((?<tp>`)[^\`]*?`|(?<sg>')[^']*?'|(?<db>")[^"]*?")*/g;
  var replaceVal = val;

  while ((matched = reg.exec(val))) {
    var groups = (matched && matched.groups) || {};
    if (
      !matched[0] ||
      !isExtractChinese ||
      (isExtractChinese && !isExistChineseStr(matched[0]))
    ) {
      if (!matched[0]) {
        reg.lastIndex += 1;
      }
      continue;
    }
    switch (true) {
      case !!groups.tp:
        // `ssff${}sfsfsf` //
        replaceVal = replaceVal.replace(matched[0], v => {
          // return v;
          var valStr = v.slice(1, -1); // 去除 ` `
          var reg = /^.*?(?=\${)|\${[^}]*?}|(?<=})[^{}]*?(?=\${)|(?<=})[^}]*$/gs;
          var matchArr = valStr.match(reg) || [];
          if (!isEmpty(matchArr)) {
            var r = matchArr
              .map(m => {
                var commonMark = "`";
                if (mark == "`") {
                  mark = varMark;
                }
                if (
                  !isExtractChinese ||
                  (isExtractChinese && !isExistChineseStr(m))
                ) {
                  if (m) {
                    return `${commonMark}${m}${commonMark}`;
                  } else {
                    return "";
                  }
                }
                if (/\${[^}]*}/.test(m)) {
                  // :prop="'发顺丰'+`sfss随风${'舒服舒服'+"司法所发生"}司法所发生${`舒服舒服`}爽肤水`+'爽肤水'"
                  // 未考虑两层模板字符。vue是否允许两层模板字符的写法有待考虑
                  var valStr = m.slice(2, -1);
                  if (!valStr) {
                    return `\${}`;
                  }
                  // return m;
                  return `\$\{${getReplaceExpVal({
                    mark,
                    varMark,
                    val: valStr,
                    translateMap,
                    translateMark,
                    isExtractChinese
                  })}\}`;
                } else {
                  var mArr = m
                    .split(/\r\n/)
                    .filter(f => f.trim())
                    .map(s => s.trim());
                  return mArr
                    .map(mv => {
                      if (translateMap.has(mv)) {
                        return `${translateMark}(${varMark}${
                          translateMap.get(mv).key
                        }${varMark})`;
                      } else {
                        return `${commonMark}${mv}${commonMark}`;
                      }
                    })
                    .reduce((a, c) => {
                      return a ? `${a}+${c}` : c;
                    }, "");
                }
              })
              .filter(f => f)
              .reduce((a, c) => {
                return a ? `${a}+${c}` : c;
              }, "");

            return r;
          } else if (
            isExtractChinese &&
            isExistChineseStr(valStr) &&
            translateMap.has(valStr)
          ) {
            return `${translateMark}(${varMark}${
              translateMap.get(valStr).key
            }${varMark})`;
          }
          return v;

          // if (/(?<=\${[^`}]*)`.*`(?=[^}]*})/.text(v)) {
          //   console.log("please attention this situation"); // todo
          // }
        });
        break;
      case !!groups.sg:
      case !!groups.db:
        var valStr = matched[0].slice(1, -1); // 去除 ' ' | " "
        if (translateMap.has(valStr)) {
          replaceVal = replaceVal.replace(matched[0], v => {
            // var valStr = v.slice(1,-1) // 去除 ' ' | " "
            var m = groups.sg || groups.db;
            return `${translateMark}(${m}${translateMap.get(valStr).key}${m})`;
          });
        }
        break;
      default:
        break;
    }
  }

  // if (typeof val == "string" && val.includes("放松放松发算法舒服舒服")) {
  //   console.log(val, replaceVal);
  // }
  return replaceVal;
}

// function getEqualValReg({k,v}){
//   return new RegExp(`\(${addSlash(k)}\)\=\(\'\|\"\)\(${addSlash(v)}\)\\2`)
// }

function replaceBindedPropStr({
  str,
  k,
  v,
  translateMap,
  translateMark,
  getEqualValReg,
  isExtractChinese = true,
  isJsx = false
}) {
  getEqualValReg =
    getEqualValReg ||
    function({ k, v, isJsx }) {
      if (isJsx) {
        return new RegExp(`\(${addSlash(k)}\)\=\(\{\)\(${addSlash(v)}\)\(\}\)`);
      } else {
        return new RegExp(
          `\(${addSlash(k)}\)\=\(\'\|\"\)\(${addSlash(v)}\)\\2`
        );
      }
    };
  return str.replace(
    // new RegExp(`\(${addSlash(k)}\)\=\(\'\|\"\)\(${addSlash(v)}\)\\2`),
    getEqualValReg({ k, v, isJsx }),
    (...params) => {
      var prop = params[1];
      var markStart = params[2];
      var varMark = isJsx ? '"' : markStart === '"' ? "'" : "'";
      var val = params[3];
      var markEnd = isJsx ? params[4] : markStart; //'}'
      var mark = isJsx ? (varMark == '"' ? "'" : '"') : markStart;
      // val   此种情况未考虑 `${`sf's'ff`}`
      // var valAst = extractMinStr({ str: v.trim(), isExtractChinese });
      // log(valAst);
      if (!isExtractChinese || (isExtractChinese && !isExistChineseStr(val))) {
        return params[0];
      } else {
        // prop,mark,
        // return params[0];
        // str: params[0],

        var convertStr = getReplaceExpVal({
          mark,
          varMark,
          val,
          translateMap,
          translateMark,
          isExtractChinese
        });
        // return params[0];
        // console.log(convertStr);
        var r = `${prop}=${markStart}${convertStr}${markEnd}`;
        return r;
      }
    }
  );
}

// function bindingFun({ str, k, v, mark, varMark, translateMap, translateMark }) {
//   if (translateMap.has(v)) {
//     var key = translateMap.get(v).key;
//     var varVal = `${translateMark}(${varMark}${key}${varMark})`;
//     return `:${k}=${mark}${varVal}${mark}}`;
//   } else {
//     return str;
//   }
// }

function replaceSaticeAttr({
  str,
  k,
  v,
  translateMap,
  translateMark,
  isExtractChinese,
  isJsx,
  getEqualValReg,
  bindingFun = ({
    str,
    isJsx,
    k,
    v,
    mark,
    markStart,
    markEnd,
    varMark,
    translateMap,
    translateMark
  }) => {
    if (translateMap.has(v)) {
      var key = translateMap.get(v).key;
      if (isJsx) {
        var varVal = `${translateMark}(${varMark}${key}${varMark})`;
        return `${k}=${markStart}${varVal}${markEnd}`;
      } else {
        var varVal = `${translateMark}(${varMark}${key}${varMark})`;

        return `:${k}=${markStart}${varVal}${markEnd}}`;
      }
    } else {
      return str;
    }
  }
}) {
  if (isExtractChinese && !isExistChineseStr(v)) {
    return str;
  }

  getEqualValReg =
    getEqualValReg ||
    function({ k, v, isJsx }) {
      // if (isJsx) {
      //   return new RegExp(`\(${addSlash(k)}\)\=\(\{\)\(${addSlash(v)}\)\(\}\)`);
      // } else {
      return new RegExp(`\(${addSlash(k)}\)\=\(\'\|\"\)\(${addSlash(v)}\)\\2`);
      // }
    };
  var reg = new RegExp(`\(${addSlash(k)}\)\=\(\'\|\"\)\(${addSlash(v)}\)\\2`);
  str = str.replace(getEqualValReg({ k, v, isJsx }), (...params) => {
    // var prop = params[1];
    // var mark = params[2];
    // var val = params[3];
    // var varMark = mark == '"' ? "'" : "'";
    // var markStart

    var prop = params[1];
    var markStart = isJsx ? "{" : params[2];
    var varMark = isJsx ? '"' : markStart === '"' ? "'" : "'";
    var val = params[3];
    var markEnd = isJsx ? "}" : markStart; //'}'
    var mark = isJsx ? (varMark == '"' ? "'" : '"') : markStart;
    var r = bindingFun({
      str: params[0],
      k: prop,
      v: val,
      isJsx,
      mark,
      markStart,
      markEnd,
      varMark,
      translateMap,
      translateMark
    });
    return r;
  });

  return str;
}

function replaceTpStrAttr({
  str,
  k,
  v,
  equalVal,
  translateMap,
  translateMark,
  isExtractChinese = true,
  isJsx,
  isBindedVarFun = ({ k, v, str, isJsx, equalVal }) => {
    if (isJsx) {
      return /^[^=]+={[^}]*}$/.test(equalVal);
    } else {
      return /^v-|^@|^:|^\.|^\#/.test(k);
    }
  },
  bindingFun
}) {
  // todo 是否排除 :class ="{{}}" :style="{{}}"
  if (isBindedVarFun({ k, v, str, isJsx, equalVal })) {
    if (v && v !== "{}") {
      // v-for
      str = replaceBindedPropStr({
        str,
        k,
        v,
        translateMap,
        translateMark,
        isExtractChinese,
        isJsx
      });
    }
  } else {
    str = replaceSaticeAttr({
      str,
      k,
      v,
      translateMap,
      translateMark,
      isExtractChinese,
      isJsx,
      bindingFun
    });
  }
  return str;
}
function replaceInnerTagText({
  str,
  text,
  isExtractChinese,
  translateMap,
  translateMark,
  delimiter,
  quoteInDelimiter
}) {
  // if (lodash.isString(text) && isExtractChinese && isExistChineseStr(text)) {
  text
    .split(/\r\n/)
    .filter(f => getChineseStrBoolean({ str: f, isExtractChinese }))
    .map(s => s.trim())
    .forEach(e => {
      if (translateMap.has(e)) {
        str = str.replace(e, v => {
          return `${delimiter.start}${translateMark}(${quoteInDelimiter}${
            translateMap.get(v).key
          }${quoteInDelimiter})${delimiter.end}`;
        });
      }
    });
  // }
  return str;
}
function replaceTpStrByAst({
  str,
  strAst,
  translateMap,
  translateMark,
  isExtractChinese,
  delimiter = {
    start: "{{",
    end: "}}"
  },
  quoteInDelimiter = "'"
}) {
  // isExtractChinese 改为需要替换语言正则表达
  if (isEmpty(strAst)) {
    return str;
  }
  // (/^v-|^@|^:|^\.|^#/)

  const TAG_NODE = 1;
  const TEX_EXP_NODE = 2;
  const TEXT_STATIC_NODE = 3;
  // str, strAst, translateMap
  // log(strAst);
  // translateMap key zhStr enStr
  var replaceStr = str;
  switch (strAst.type) {
    case TAG_NODE:
      if (!isEmpty(strAst.attrsMap)) {
        replaceStr = Object.entries(strAst.attrsMap)
          .filter(([k, v]) =>
            getChineseStrBoolean({ str: v, isExtractChinese })
          )
          .reduce((a, [k, v]) => {
            return replaceTpStrAttr({
              str: a,
              k,
              v,
              translateMap,
              translateMark,
              isExtractChinese
            });
          }, replaceStr);
      }
      if (!isEmpty(strAst.children)) {
        replaceStr = strAst.children.reduce((a, c) => {
          return replaceTpStrByAst({
            str: a,
            strAst: c,
            translateMap,
            translateMark,
            isExtractChinese
          });
        }, replaceStr);
      }
      break;
    case TEX_EXP_NODE:
      if (!isEmpty(strAst.tokens)) {
        replaceStr = strAst.tokens.reduce((a, text) => {
          if (
            lodash.isString(text) &&
            isExtractChinese &&
            isExistChineseStr(text)
          ) {
            return replaceInnerTagText({
              str: a,
              text,
              isExtractChinese,
              translateMap,
              translateMark,
              delimiter,
              quoteInDelimiter
            });
          }
          if (
            lodash.isObject(text) &&
            isExtractChinese &&
            isExistChineseStr(text["@binding"])
          ) {
            return a.replace(text["@binding"], t => {
              var r = getReplaceExpVal({
                mark: '"',
                varMark: "'",
                val: t,
                translateMap,
                translateMark,
                isExtractChinese
              });
              return r;
            });
          }
          return a;
        }, replaceStr);
      }

      break;
    case TEXT_STATIC_NODE:
      var text = strAst.text;
      if (isExtractChinese && isExistChineseStr(text)) {
        replaceStr = replaceInnerTagText({
          str: replaceStr,
          text,
          isExtractChinese,
          translateMap,
          translateMark,
          delimiter,
          quoteInDelimiter
        });
      }
      break;

    default:
      break;
  }

  return replaceStr;
}

function replaceStrOfTemplateFun({ str, strAst, ...params }) {
  if (!strAst) {
    return str;
  }

  // 替换注释掉的内容存起来
  var commentConentMap = new Map();
  var reg = /<!--.*?-->/gs;
  // log(sha256);
  var strWithouComment = str.replace(reg, v => {
    var key = sha256(v)
      .toString()
      .slice(0, 64);
    if (commentConentMap.has(key)) {
      key = sha256(v + Date.now())
        .toString()
        .slice(0, 64);
    }
    commentConentMap.set(key, v);
    return key;
  });

  if (params.isExtractChinese && !isExistChineseStr(strWithouComment)) {
    return str;
  }
  var r = replaceTpStrByAst({ str: strWithouComment, strAst, ...params });

  var mapArr = Array.from(commentConentMap.entries());
  r = mapArr.reduce((a, [k, v]) => {
    return a.replace(k, v);
  }, r);

  return r;
}

async function getReplaceStrOfTemplate({
  str,
  strAst,
  translateMap,
  translateMark = "$t",
  isExtractChinese = true
}) {
  if (!isExtractChinese) {
    return null;
  }
  var matched = getRegExpWithTemplateTag().exec(str);
  if (!matched) {
    return null;
  }
  var tpStr = matched[0];
  var value = replaceStrOfTemplateFun({
    str: tpStr,
    strAst,
    translateMap,
    translateMark,
    isExtractChinese
  });
  return {
    source: tpStr,
    value
  };
}

function setLangStrForScriptStrWithoutJsxAndComment({
  str,
  strAstArr,
  translateMap,
  isExtractChinese
}) {
  var flatArr = strAstArr.flat(Infinity);
  if (isEmpty(flatArr)) {
    return str;
  }
  // 忽略props中的中文字符串，正确做法是单独提取props的中文字符串，做特定的操作，比如引入i18n,为props中存在中文字符串，调用i18n函数
  var expValStr = flatArr.map(o => {
    return o.str;
  });

  var replaceStr = expValStr.reduce((a, c) => {
    if (c && lodash.isString(c)) {
      var varMark = c.slice(0, 1);
      var mark = varMark === '"' ? '"' : "'";
      var rpVal = getReplaceExpVal({
        mark,
        varMark,
        val: c,
        translateMap,
        translateMark: "this.$t",
        isExtractChinese
      });
      a = a.replace(c, rpVal);
      return a;
    } else {
      return a;
    }
  }, str);

  /* todo reduce 调用异步函数
  var replaceStr = flatArr.reduce(async (a, c) => {
     log(c);
     log(a);
  }, str); */

  return replaceStr;
}

async function replaceStrOfScriptFun({
  str,
  jsxStrArr,
  strAstArr,
  translateMap,
  isVue,
  isExtractChinese
}) {
  /*  已经去除注释 // \/\* \*\/ \{\/\* \*\/\} */
  if (!isExtractChinese) {
    return str;
  }
  var replacedStr = str;

  if (!isEmpty(jsxStrArr)) {
    var jsxMap = new Map();
    var strWithoutJsx = replacedStr;
    jsxStrArr.forEach(v => {
      var k = sha256(v)
        .toString()
        .slice(0, 64);
      if (jsxMap.has(k)) {
        k = sha256(v + Date.now())
          .toString()
          .slice(0, 6);
      }
      jsxMap.set(k, v);
      strWithoutJsx = strWithoutJsx.replace(v, k);
    });
    if (!isExistChineseStr(strWithoutJsx)) {
      return str;
    }
    strWithoutJsx = setLangStrForScriptStrWithoutJsxAndComment({
      str: strWithoutJsx,
      strAstArr,
      translateMap,
      isExtractChinese
    });
    var mapArr = Array.from(jsxMap.entries());
    replacedStr = mapArr.reduce((a, [k, v]) => {
      return a.replace(k, v);
    }, strWithoutJsx);
  } else {
    if (!isExistChineseStr(str)) {
      return str;
    }
    replacedStr = setLangStrForScriptStrWithoutJsxAndComment({
      str: replacedStr,
      strAstArr,
      translateMap,
      isExtractChinese
    });
  }
  return replacedStr;
}

function replaceJsxStrByAst({ str, ast, translateMap, isExtractChinese }) {
  if (isExtractChinese && !isExistChineseStr(str)) {
    return str;
  }
  // log(ast);
  var type = ast.type;
  // #text #jsx
  // var TAG_NODE =

  // getReplaceExpVal(
  //   ({ mark, varMark, val, translateMap, translateMark, isExtractChinese }: {
  //     mark: any,
  //     varMark: any,
  //     val: any,
  //     translateMap: any,
  //     translateMark: any,
  //     isExtractChinese: any
  //   })
  // );
  var translateMark = "this.$t";
  // str;
  switch (true) {
    case /^\w/.test(type):
      // log(ast);
      if (!isEmpty(ast.props)) {
        str = Object.entries(ast.props).reduce((a, [k, v]) => {
          // console.log(v);
          if (lodash.isObject(v)) {
            var val = v.nodeValue;
            var equalVal = `${k}={${val}}`;
          } else {
            var val = v;
            var equalVal = `${k}="${val}"`;
          }

          return replaceTpStrAttr({
            str: a,
            k,
            v: val,
            isJsx: true,
            equalVal,
            translateMap,
            isExtractChinese,
            translateMark
          });
        }, str);
      }
      if (!isEmpty(ast.children)) {
        str = ast.children.reduce(
          (a, child) =>
            replaceJsxStrByAst({
              str: a,
              ast: child,
              translateMap,
              isExtractChinese
            }),
          str
        );
      }
      break;
    case /^#jsx/.test(type):
      var text = ast.nodeValue.trim();
      if (isExtractChinese && isExistChineseStr(text)) {
        str = text
          .split(/\r\n/g)
          .filter(f => getChineseStrBoolean({ str: f, isExtractChinese }))
          .map(s => s.trim())
          .reduce((a, c) => {
            if (translateMap.has(c)) {
              return a.replace(
                c,
                `{${translateMark}(${translateMap.get(c).key})}`
              );
            } else {
              return a;
            }
          }, str);
      }
      // str = str.replace(
      //   ast.nodeValue,
      //   getReplaceExpVal({
      //     mark: "'",
      //     varMark: '"',
      //     val: ast.nodeValue,
      //     translateMap,
      //     translateMark,
      //     isExtractChinese
      //   })
      // );
      break;
    case /^#text/.test(type):
      var text = ast.nodeValue;
      if (isExtractChinese && isExistChineseStr(text)) {
        str = text
          .trim()
          .split(/\r\n/g)
          .filter(f => getChineseStrBoolean({ str: f, isExtractChinese }))
          .map(s => s.trim())
          .reduce((a, c) => {
            if (translateMap.has(c)) {
              return a.replace(
                c,
                `{${translateMark}(${translateMap.get(c).key})}`
              );
            } else {
              return a;
            }
          }, str);
      }
      break;

    default:
      break;
  }
  // str;
  return str;
}

async function replaceStrOfJsxFun({
  strArr,
  strAstArr,
  isExtractChinese,
  translateMap
  // exCludeComment = true
}) {
  if (
    isEmpty(strArr) ||
    !isExtractChinese ||
    (isExtractChinese && strArr.every(e => !isExistChineseStr(e)))
  ) {
    return null;
  }
  // log(strAstArr);
  return strArr.map((str, index) => {
    if (isExtractChinese && isExistChineseStr(str)) {
      var r = replaceJsxStrByAst({
        str,
        ast: strAstArr[index],
        translateMap,
        isExtractChinese
      });
      return r;
    } else {
      return str;
    }
  }); // {sourceStr, str}
}

function getJsxStrArrByReg({ str, isVue }) {
  var withoutScriptTagStr = str;
  if (isVue) {
    var withoutScriptTag = /(?<=\s*<(script)('[^']*'|"[^"]*"|[^'">])*>)[\s\S]*(?=\s*<\/\1>)/g.exec(
      str
    );
    var withoutScriptTagStr = (withoutScriptTag && withoutScriptTag[0]) || "";
  }
  var jsxReg = getScriptJsxReg();
  jsxStrArr = withoutScriptTagStr.match(jsxReg) || [];
  return jsxStrArr;
}

async function getReplaceStrOfScript({
  str,
  strAst,
  isVue,
  translateMap,
  isExtractChinese
}) {
  if (!isExtractChinese) {
    return null;
  }
  var scriptStr = str;
  if (isVue) {
    var matched = getRegExpWithScriptTag().exec(str);
    if (!matched) {
      return null;
    }
    // 是否要去除 <script>
    // function fun(){in '中文'}
    //export default {
    //
    // }的内容，得证明
    // </script>
    // sha256
    // scriptStr;
    // var outOfExport;

    scriptStr = matched[0];
  }

  var commentConentMap = new Map();
  var reg = /\/\/[^\r\n]*|{\/\*[^]*?\*\/}|\/\*[^]*?\*\//g;
  // var reg = /\/\/[^\r\n]*|\/\*[^]*?\*\//g;
  var strWithoutComment = scriptStr.replace(reg, v => {
    var k = sha256(v)
      .toString()
      .slice(0, 64);
    if (commentConentMap.has(k)) {
      k = sha256(v + Date.now())
        .toString()
        .slice(0, 64);
    }
    commentConentMap.set(k, v);
    return k;
  });

  if (isExtractChinese && !isExistChineseStr(strWithoutComment)) {
    return null;
  }

  // log(strAst);

  var jsxStrArr = [];

  if (!isEmpty(strAst.jsxStr) && !isEmpty(strAst.jsxStr.value)) {
    jsxStrArr = getJsxStrArrByReg({ str: strWithoutComment, isVue });
  }

  var [pureScriptStr, jsxStrRpArr] = await Promise.all([
    replaceStrOfScriptFun({
      str: strWithoutComment,
      jsxStrArr,
      strAstArr: (strAst.varStr && strAst.varStr.value) || [],
      translateMap,
      isVue,
      isExtractChinese
    }),
    replaceStrOfJsxFun({
      strArr: jsxStrArr,
      strAstArr: (strAst.jsxStr && strAst.jsxStr.value) || [],
      translateMap,
      isExtractChinese
    })
  ]);
  var strWithoutCommentI18n = jsxStrRpArr.reduce(
    (a, c) => a.replace(c.source, c.value),
    pureScriptStr
  );
  var mapArr = Array.from(commentConentMap.entries());
  var replaceStr = mapArr.reduce(
    (a, [k, v]) => a.replace(k, v),
    strWithoutCommentI18n
  );
  return {
    source: scriptStr,
    value: replaceStr
  };
}

async function replaceFileStr({
  str,
  file,
  isExtractChinese = true,
  translateMap
}) {
  var type = path.extname(file);

  var o = extractStr({
    str,
    type,
    file,
    isExtractChinese
  });

  if (type == ".vue") {
    var strArr = await Promise.all([
      getReplaceStrOfTemplate({
        str,
        strAst: o.template,
        translateMap,
        isExtractChinese
      }),
      getReplaceStrOfScript({
        str,
        strAst: o.script,
        isVue: true,
        isExtractChinese,
        translateMap
      })
    ]);
    str = strArr.reduce(
      (a, c) => (c && a.replace(c.source, c.value)) || a,
      str
    );
    // strArr.forEach(rpObj => {
    //   if (rpObj) {
    //     str = str.replace(rpObj.source, rpObj.value);
    //   }
    // });
    // str;
  }
  if (type == ".js") {
    var rpObj = await getReplaceStrOfScript({
      str,
      strAst: o.script,
      isVue: false,
      isExtractChinese,
      translateMap
    });
    rpObj && (str = str.replace(rpObj.source, rpObj.value));
  }
  // log(o);
  return str;
}

async function autoI18n({ file, json, outPut, isExtractChinese = true }) {
  // await isExistChForFiles(file)
  // isExistChineseStr(str.replace(getExcludeCommentRegForVue(),''))
  var translateMap = await setTranslateMap({
    file,
    json,
    outPut,
    isExtractChinese
  });
  // translateMap;
  // zhStrMap =
  var files = glob.sync(file.p, file.options);
  await Promise.all(
    files.map(async f => {
      var str = String(await readFile(f));
      if (!isExistChineseStr(str.replace(getExcludeCommentRegForVue(), ""))) {
        return null;
      }
      await replaceFileStr({
        str,
        file: f,
        isExtractChinese,
        translateMap
      });
    })
  );
}

autoI18n({
  file: { p: resolve(__dirname, "./test.vue") },
  json: { p: resolve(__dirname, "../src/local/**/**.json") },
  outPut:{
    dir: resolve(__dirname, "./"),
    fileNameList: ["i18n_common_zh.json", "i18n_common_en.json"]
  }
  // isExtractChinese: true
});

// todo  确定 <template> <script> ，出现的先后顺寻 谁先出现，先提取谁，提取之前最好用eslint格式化
// <template>。*</template> 以及 <script> .* </script>前面的空格必然是最少的。
