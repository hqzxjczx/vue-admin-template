function Hoc(WrappedComponent) {
  return {
    mounted() {
      console.log('I have already mounted')
    },
    props: WrappedComponent.props,
    render(h, cxt) {
      console.log('WrappedComponent', cxt, WrappedComponent)
      const slots = Object.keys(this.$slots)
        .reduce((arr, key) => arr.concat(this.$slots[key]), [])
        .map(vnode => {
          vnode.context = this._self
          return vnode
        })

      return h(
        WrappedComponent,
        {
          on: this.$listeners,
          props: this.$props,
          // 透传 scopedSlots
          scopedSlots: this.$scopedSlots,
          attrs: this.$attrs
        },
        slots
      )
    }
  }
}

export default Hoc
