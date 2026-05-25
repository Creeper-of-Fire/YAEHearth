/** 实体类型 = content/ 下的子目录名，完全可扩展 */
export type ContentType = string

export interface ContentEntity
{
    /** 主键，与文件名一致 */
    id: string
    /** 所属类型桶（characters/scenes/items/...） */
    type: ContentType
    /** 动态数据，完全自由 */
    frontmatter: Record<string, any>
    /** 静态 markdown 内容 */
    body: string
}

export interface ContentEvent
{
    action: 'add' | 'change' | 'delete'
    type: ContentType
    id: string
    entity?: ContentEntity
}
