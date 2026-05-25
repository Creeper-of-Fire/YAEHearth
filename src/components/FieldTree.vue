<script lang="ts" setup>
defineProps<{
  fields: [string, any][]
}>()
</script>

<template>
  <div class="field-tree">
    <div v-for="([key, val]) in fields" :key="key" class="field-node">
      <template v-if="val && typeof val === 'object' && !Array.isArray(val)">
        <div class="field-label">{{ key }}</div>
        <FieldTree :fields="Object.entries(val)" class="field-nested"/>
      </template>
      <template v-else-if="Array.isArray(val)">
        <div class="field-label">{{ key }}</div>
        <ul class="field-list">
          <li v-for="(item, i) in val" :key="i">
            <template v-if="item && typeof item === 'object'">
              <FieldTree :fields="Object.entries(item)" class="field-nested"/>
            </template>
            <template v-else>{{ item }}</template>
          </li>
        </ul>
      </template>
      <template v-else>
        <div class="field-leaf">
          <span class="field-label">{{ key }}</span>
          <span class="field-value">{{ val }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.field-tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-nested {
  margin-left: 12px;
  padding-left: 8px;
  border-left: 1px solid #434347;
}

.field-leaf {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: baseline;
}

.field-leaf > .field-label {
  color: #777777;
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.field-leaf > .field-value {
  color: #cccccc;
}

.field-list {
  margin: 2px 0 0 12px;
  padding: 0;
  list-style: disc;
  color: #999999;
  font-size: 13px;
}
</style>
