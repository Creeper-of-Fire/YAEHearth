<script lang="ts" setup>
import {computed} from 'vue'
import {marked} from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ source: string }>()

const html = computed(() => DOMPurify.sanitize(marked.parse(props.source ?? '', {async: false}) as string))
</script>

<template>
  <div class="md-view" v-html="html"/>
</template>

<style scoped>
.md-view {
  line-height: 1.6;
  word-break: break-word;
}

.md-view :deep(h1),
.md-view :deep(h2),
.md-view :deep(h3),
.md-view :deep(h4) {
  margin: 0.6em 0 0.3em;
  font-weight: bold;
  color: #dddddd;
}

.md-view :deep(h1) { font-size: 1.2em; }
.md-view :deep(h2) { font-size: 1.1em; }
.md-view :deep(h3) { font-size: 1em; }
.md-view :deep(h4) { font-size: 0.95em; }

.md-view :deep(p) {
  margin: 0.4em 0;
}

.md-view :deep(strong) {
  color: #eeeeee;
}

.md-view :deep(em) {
  color: #cccccc;
}

.md-view :deep(ul),
.md-view :deep(ol) {
  padding-left: 1.5em;
  margin: 0.3em 0;
}

.md-view :deep(li) {
  margin: 0.15em 0;
}

.md-view :deep(blockquote) {
  border-left: 3px solid #555555;
  padding-left: 0.8em;
  margin: 0.5em 0;
  color: #999999;
}

.md-view :deep(code) {
  background: #2a2a2e;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

.md-view :deep(hr) {
  border: none;
  border-top: 1px solid #434347;
  margin: 0.8em 0;
}
</style>
