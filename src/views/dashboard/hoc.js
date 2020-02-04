import { createHoc, normalizeSlots } from 'vue-hoc'
// // normalizeSlots  = flatten Object to Array
// // {a:{b:'c'}, d: [{e: 'f', g: 'h'}]} --> [{b: 'c'}, {e: 'f'}, g: 'h'}]
import { Table, TableColumn, Pagination } from 'element-ui'
console.log(Table, Table, Pagination)
// function getKeysArr(obj) {
//   return Object.keys(obj)
// }

// function getSameKeys(arr2, arr1) {
//   const result = []
//   return arr2.filter(a => {
//     return arr1.some(i => {
//       return i == a
//     })
//   })
// }

// var tableArr = getKeysArr(Table.props)
// var columnArr = getKeysArr(TableColumn.props)
// var paginationArr = getKeysArr(Pagination.props)
// console.log('table column', getSameKeys(tableArr, columnArr))
// console.log('table pagination', getSameKeys(tableArr, paginationArr))
// console.log('column pagination', getSameKeys(columnArr, paginationArr))

// const arr = [Table, TableColumn, Pagination]
// console.log(Table.props)
// let totalArr = []
// arr.forEach(item => {
//   totalArr = totalArr.concat(getKeysArr(item.props))
// })

// console.log(Array.from(new Set(totalArr)))
// console.log('table', getKeysArr(Table.props))
// console.log('tableCOlumn', getKeysArr(TableColumn.props))
// console.log('Pagination', getKeysArr(Pagination.props))

// var totalArr = [].concat(Table.props, TableColumn.props, Pagination.props)

// createHoc(Table, )
// TableColumnPagination)

// function CommonTableHoc() {
//   return {
//     data() {
//       return {
//         data: ''
//       }
//     },
//     methods: {},
//     render(h) {
//       // const a = <div>Mfsfs</div>
//       return h('div', ['fsfsff'])
//     }
//   }
// }

// export default CommonTableHoc

// table column "width", "context"
// table 组件和 tableColumn组件 width 以及context 属性冲突了需要为 tableColumn 的width context 属性加前缀
// table 和 pagination 的时间名冲突 为 current-change
function HOC() {
  // const props = (WrappedComponent && { ...WrappedComponent.props }) || {}
  return {
    // functional: true,
    props: {
      ...Pagination.props,
      ...TableColumn.props,
      ...Table.props,
      columnWidth: TableColumn.props.width,
      columnContext: TableColumn.props.context
    },
    computed: {},
    mounted() {
      console.log('I have already mounted')
    },
    // props,
    render(h, cxt) {
      const slots = Object.keys(this.$slots)
        .reduce((arr, key) => arr.concat(this.$slots[key]), [])
        .map(vnode => {
          vnode.context = this._self
          return vnode
        })

      // return h(
      //   'div',
      //   {
      //     on: this.$listeners,
      //     props: this.$props,
      //     // 透传 scopedSlots
      //     scopedSlots: this.$scopedSlots,
      //     attrs: this.$attrs
      //   },
      //   ['dfdf', slots]
      // )
      return <div>fsfsf</div>
    }
  }
}

export default HOC()
