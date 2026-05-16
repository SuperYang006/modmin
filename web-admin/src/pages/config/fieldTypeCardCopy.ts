export function getFieldTypeCardCopy(type: string) {
  if (type === 'text') {
    return '单行内容'
  }

  if (type === 'textarea') {
    return '多行文本'
  }

  if (type === 'richtext') {
    return '富文本内容'
  }

  if (type === 'markdown') {
    return 'Markdown 文档'
  }

  if (type === 'number') {
    return '数值输入'
  }

  if (type === 'boolean') {
    return '是 / 否'
  }

  if (type === 'date') {
    return '日期'
  }

  if (type === 'datetime') {
    return '日期时间'
  }

  if (type === 'enum') {
    return '固定选项'
  }

  if (type === 'relation') {
    return '同一模型中的单条记录'
  }

  if (type === 'multiRelation') {
    return '同一模型中的多条记录'
  }

  if (type === 'polyRelation') {
    return '多个模型中的单条记录'
  }

  if (type === 'multiPolyRelation') {
    return '多个模型中的多条记录'
  }

  if (type === 'array') {
    return '多值集合'
  }

  if (type === 'image') {
    return '图片资源'
  }

  if (type === 'file') {
    return '文件资源'
  }

  if (type === 'video') {
    return '视频资源'
  }

  if (type === 'audio') {
    return '音频资源'
  }

  if (type === 'json') {
    return '结构化数据'
  }

  if (type === 'location') {
    return '经纬度位置'
  }

  if (type === 'address') {
    return '省市区地址'
  }

  return '字段类型'
}
