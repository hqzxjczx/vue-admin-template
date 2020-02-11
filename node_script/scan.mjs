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

  return innerExpressionArr.concat(outerExpressionArr);
}

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

function extractMinStr({
  str,
  isExtractChinese = true,
  isExpresstional = true
}) {
  if (!str) {
    return [];
  }

  if (isExpresstional) {
    var reg = /\`[^\`]*\`|\'[^\']*\'|\"[^\"]*\"/g;

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
            return s.trim();
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
      var text = obj.text.trim();
      if (!text) {
        return [];
      }
      return isExtractChinese ? (isExistChineseStr(text) ? text : []) : text;
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
      var nodeValue = obj.nodeValue.trim();
      return [
        isExtractChinese
          ? isExistChineseStr(nodeValue)
            ? nodeValue
            : false
          : nodeValue
      ];
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

// console.log(isExistChForFiles({ p: resolve(__dirname, "./test.vue") }));

async function setTranslateMap({
  file,
  json,
  outPut = {
    dir: resolve(__dirname, "./"),
    fileNameList: ["common_zn.json", "common_en.json"]
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
  var { dir, fileNameList } = outPut;
  // console.log(dir, fileNameList);
  // console.log(strArr);
  // keyMap;
  // requestForTranslate(data[0]);
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
function replaceStrOfTemplateFun(str, strAst) {
  // strAst;
  return "";
}

async function getReplaceStrOfTemplate(str, strAst) {
  // (/^v-|^@|^:|^\.|^#/)
  var matched = getRegExpWithTemplateTag().exec(str);
  if (!matched) {
    return null;
  }
  var tpStr = matched[0];
  var value = replaceStrOfTemplateFun(tpStr, strAst);
  return {
    rpStr: tpStr,
    value
  };
}

function replaceStrOfScriptFun(str, strAst) {
  return "";
}

async function getReplaceStrOfScript(str, strAst, isVue) {
  var matched = getRegExpWithScriptTag().exec(str);
  var scriptStr = matched[0];
  var value = replaceStrOfScriptFun(scriptStr, strAst);
  return {
    rpStr: scriptStr,
    value
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
      getReplaceStrOfTemplate(str, o.template),
      getReplaceStrOfScript(str, o.script, true)
    ]);
    strArr.forEach(rpObj => {
      if (rpObj) {
        str = str.replace(rpObj.rpStr, rpObj.value);
      }
    });
  }
  if (type == ".js") {
    var rpObj = await getReplaceStrOfScript(str, o.script, true);
    rpObj && (str = str.replace(rpObj.rpStr, rpObj.value));
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
  json: { p: resolve(__dirname, "../src/local/**/**.json") }
  // isExtractChinese: true
});
