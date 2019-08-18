<template>
  <div class="dashboard-container">
    <div class="dashboard-text">name: {{ name }}</div>
    <wrapper-hoc level="1">
      fsfsdf
    </wrapper-hoc>
    <!-- <anchored-heading level="2">
      anchored-heading
    </anchored-heading> -->
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
// import WrapperHoc from '@/components/wrapperHoc.js';
import Vue from 'vue';
export default {
  name: 'Dashboard',
  components: {
    wrapperHoc: Vue.extend({
      functional: true,
      render(h) {
        return (
          <div>
            <slot></slot>
          </div>
        )
      }
    })

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
