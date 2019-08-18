<template>
  <div>
    <el-table
      :data="data"
      v-bind="attrs"
      v-on="listeners"
    >
      <el-table-column
        v-for="(item, index) in config"
        :key="index"
        v-bind="item"
      >
        <template
          v-if="$scopedSlots.default"
          #default="{row}"
        >
          <slot :default="row" />
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      :current-page="currentPage"
      :page-sizes="[100, 200, 300, 400]"
      :page-size="100"
      layout="total, sizes, prev, pager, next, jumper"
      :total="400"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>
<script>
export default {
  name: 'CommonTable',
  props: {
    defTbProps: {
      type: Object,
      default: null
    },
    defTbItemProps: {
      type: Object,
      default: null
    },
    defPagesProps: {
      type: Object,
      default: null
    },
    data: {
      type: Array,
      default: () => []
    },
    config: {
      type: [Object, Array],
      default: () => []
    }
  },
  data() {
    return {
      currentPage: 1
    }
  },
  computed: {
    attrs() {
      return Object.assign(this.defTbProps, this.$attrs)
    },
    listeners() {
      return this.$listeners
    }
  },
  methods: {
    handleSizeChange(val) {
      console.log(`每页 ${val} 条`)
    },
    handleCurrentChange(val) {
      console.log(`当前页: ${val}`)
    }
  }
}
</script>
