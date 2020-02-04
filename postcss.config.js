// https://github.com/michael-ciniawsky/postcss-load-config

module.exports = {
  // 添加插件名称作为键，参数作为值
  // 使用npm或yarn安装它们
  plugins: {
    // to edit target browsers: use "browserslist" field in package.json
    autoprefixer: {},
    // 通过传递 false 来禁用插件
    'postcss-url': false,
    'postcss-nested': {},
    'postcss-responsive-type': {},
    'postcss-hexrgba': {},
    'postcss-pxtorem': {
      // rootValue: 16, //结果为：设计稿元素尺寸/16，比如元素宽320px,最终页面会换算成 20rem
      // propList: ['*']
      // propWhiteList: [],
      // selectorBlackList: [/^html/, /^body$/]
    }
  },
  preset: {
    // 更改postcss-preset-env 设置
    // autoprefixer: {
    //   grid: true
    // }
  }
}
