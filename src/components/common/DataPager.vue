<template>
  <div class="bf-pager">
    <div class="bf-filter-count">
      共 <b class="num">{{ total }}</b> 条<span v-if="selected"> · 已选 {{ selected }} 条</span>
    </div>
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      background
      layout="sizes, prev, pager, next, jumper"
      small
      @update:current-page="(v: number) => emit('update:page', v)"
      @update:page-size="(v: number) => emit('update:pageSize', v)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ total: number; page: number; pageSize: number; selected?: number }>()
const emit = defineEmits<{ 'update:page': [number]; 'update:pageSize': [number] }>()
</script>
