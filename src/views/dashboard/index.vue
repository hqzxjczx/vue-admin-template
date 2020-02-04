<template>
  <div class="dashboard-container">
    <div class="dashboard-text">name: {{ name }} {{ names }}</div>
    <wrapper-hoc level="2" />
    <hoc-com />
    <!-- <anchored-heading level="2">
      anchored-heading
    </anchored-heading> -->
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
// import WrapperHoc from '@/components/wrapperHoc.js';
import Vue from 'vue';
import HocCom from './hoc.js';
export default {
  name: 'Dashboard',
  components: {
    wrapperHoc: {
      // functional: true,
      props: {
        level: {
          type: String,
          default: ''
        }
      },
      render(h) {
        //   return h(
        //     'div',
        //     {
        //       on: this.$listeners,
        //       props: this.$props,
        //       attrs: this.$attrs
        //     },
        //     ['fsfs', this.level]
        //   )
        //   // return 'div';
        return <div>{this.level} fsf</div>
      }
    },
    HocCom: () => import('./hoc.js')

    // function(h) {
    //   console.log('wrapperHOcsss', h)
    //   return new Vue({
    //     props: {
    //       level: String
    //     },
    //     data: function() {
    //       return {
    //         count: 0
    //       }
    //     },
    //     template:
    //       '<button v-on:click="count++">You clicked me {{ count }} times.<slot></slot></button>'
    //   })
    // }

    // Vue.component('', {
    //   props: {
    //     level: {
    //       type: Number,
    //       required: true
    //     }
    //   },
    //   render: function(createElement) {
    //     return createElement(
    //       'h' + this.level, // tag name
    //       this.$slots.default // array of children
    //     )
    //   }
    // })
    // Vue.extend({ props: {}, template: 'div' })
    // (h, ctx) => {
    //   console.log('wrapperHoc', h, ctx)
    //   return h('div', null, [h('h1', 'sfsfs')])
    //   // WrapperHoc(
    //   //       <div>
    //   //         <slot>fsfsfs</slot>
    //   //       </div>
    //   //   )
    // }
  },
  data() {
    return {
      names: 'dataname'
    }
  },
  computed: {
    ...mapGetters(['name'])
  }
}
</script>

<style lang="scss" scoped>
.dashboard {
  &-container {
    margin: 30px;
  }
  &-text {
    font-size: 30px;
    line-height: 46px;
  }
}
</style>
