import VUe from 'vue';
import {
  ElTable,
  ElTableColunm,
  ElPaginations
} from 'element-ui';

function CommonTableHoc() {
  return {
    name: 'commonTable',
    props: {
      ...ElTableColunm.$props
    },
    computed: {
      attrs() {

      }
    },
    methods: {},
    render(h, context) {
      if (this.$sopedSlots.default) {
        var elTableCom;
      } else {}

      // return <div>

      // </div>;
      return h(div, null, [{
        'el-table',
        {
          attrs: this.attrs,
          props: {}
        },
      }, {
        'el-paginations',
        {

        }
      }])
    }
  };
}
export default Hoc;