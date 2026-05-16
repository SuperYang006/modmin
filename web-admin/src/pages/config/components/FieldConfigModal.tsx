import { Alert, Button, Card, Cascader, Col, DatePicker, Divider, Form, Input, InputNumber, Modal, Popover, Row, Select, Space, Switch, Tag, Typography } from 'antd'
import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { modelCreateFieldTypeRegistry } from '@/runtime/fieldTypes/registry'
import { getChinaAreaOptionsByGranularity, normalizeAddressPathByGranularity } from '@/runtime/address/chinaArea'
import {
  ARRAY_TYPES,
  ADDRESS_TYPES,
  DATE_TYPES,
  ENUM_TYPES,
  ITEM_COUNT_TYPES,
  LOCATION_TYPES,
  MEDIA_TYPES,
  MULTI_VALUE_TYPES,
  NUMBER_TYPES,
  POLY_RELATION_TYPES,
  RESERVED_SYSTEM_FIELD_KEYS,
  RELATION_TYPES,
  ALL_RELATION_TYPES,
  SORTABLE_TYPES,
  TEXT_LIKE_TYPES,
  changeFieldTypeState,
  createEmptyEnumOption,
  getAcceptOptionsByType,
  getAcceptPresetOptionsByType,
  getFieldTypeUsageGuide,
  type FieldConfigModalState,
} from '@/pages/config/modelFieldConfig'

interface RelationModelOption {
  label: string
  value: string
}

interface RelationFieldOption {
  label: string
  value: string
}

interface FieldConfigModalProps {
  open: boolean
  title: string
  state: FieldConfigModalState
  error: string
  isEdit?: boolean
  relationModelOptions: RelationModelOption[]
  relationFieldOptions: RelationFieldOption[]
  relationFieldOptionsMap?: Record<string, RelationFieldOption[]>
  relationFieldOptionsLoading?: boolean
  onCancel: () => void
  onSave: () => void
  onChange: (updater: (prev: FieldConfigModalState) => FieldConfigModalState) => void
}

export function FieldConfigModal(props: FieldConfigModalProps) {
  const fieldTypeOptions = modelCreateFieldTypeRegistry.map((item) => ({
    label: item.label,
    value: item.value,
  }))
  const relationModelOptionMap = new Map(props.relationModelOptions.map((item) => [item.value, item.label]))
  const fieldTypeUsageGuide = getFieldTypeUsageGuide(props.state.type)
  const relationModelOptions = props.state.relationModelCollection.trim()
    ? props.relationModelOptions.some((item) => item.value === props.state.relationModelCollection)
      ? props.relationModelOptions
      : [
          ...props.relationModelOptions,
          {
            label: `当前值（${props.state.relationModelCollection}）`,
            value: props.state.relationModelCollection,
          },
        ]
    : props.relationModelOptions
  const relationFieldOptions = props.state.relationModelCollection.trim()
    ? props.state.relationDisplayFields.every((fieldKey) => props.relationFieldOptions.some((item) => item.value === fieldKey))
      ? props.relationFieldOptions
      : [
          ...props.relationFieldOptions,
          ...props.state.relationDisplayFields
            .filter((fieldKey) => fieldKey && !props.relationFieldOptions.some((item) => item.value === fieldKey))
            .map((fieldKey) => ({
              label: `当前值（${fieldKey}）`,
              value: fieldKey,
            })),
        ]
    : props.relationFieldOptions

  function normalizeNumberInput(value: number | string | null) {
    if (value === null || value === undefined || value === '') {
      return ''
    }

    return String(value)
  }

  function getMediaDefaultValuePlaceholder(type: string) {
    if (type === 'image') {
      return '例如：https://example.com/demo.png'
    }

    if (type === 'video') {
      return '例如：https://example.com/demo.mp4'
    }

    if (type === 'audio') {
      return '例如：https://example.com/demo.mp3'
    }

    return '例如：https://example.com/demo.pdf'
  }

  function getLargeTextDefaultValuePlaceholder(type: string) {
    if (type === 'textarea') {
      return '请输入多行默认文本'
    }

    if (type === 'richtext') {
      return '请输入富文本默认内容'
    }

    if (type === 'markdown') {
      return '例如：## 默认标题'
    }

    return '请输入默认值'
  }

  function parseDateValue(value: string) {
    if (!value) {
      return null
    }

    const parsed = dayjs(value)
    return parsed.isValid() ? parsed : null
  }

  function getRelationModelDisplayLabel(collection: string) {
    const label = relationModelOptionMap.get(collection)

    if (!label) {
      return {
        title: collection,
        subtitle: collection,
      }
    }

    const suffix = `(${collection})`
    if (label.endsWith(suffix)) {
      return {
        title: label.slice(0, -suffix.length).trim(),
        subtitle: collection,
      }
    }

    return {
      title: label,
      subtitle: collection,
    }
  }

  return (
    <Modal
      open={props.open}
      title={props.title}
      onCancel={props.onCancel}
      onOk={props.onSave}
      okText="保存字段"
      cancelText="取消"
      width={820}
      className="field-config-modal"
      maskClosable={false}
      keyboard={false}
    >
      <div className="field-config-modal-scroll">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {props.error ? <Alert type="error" showIcon message={props.error} /> : null}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form layout="vertical">
              <Form.Item
                label={
                  <Space size={6}>
                    <span>字段类型</span>
                    {fieldTypeUsageGuide ? (
                      <Button
                        type="text"
                        size="small"
                        className="field-type-help-trigger"
                        icon={<QuestionCircleOutlined />}
                        onClick={() => {
                          Modal.info({
                            title: fieldTypeUsageGuide.title,
                            width: 560,
                            content: (
                              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Typography.Paragraph style={{ marginBottom: 0 }}>
                                  {fieldTypeUsageGuide.summary}
                                </Typography.Paragraph>
                                <div>
                                  <Typography.Text strong>适用示例</Typography.Text>
                                  <ul className="field-type-help-list">
                                    {fieldTypeUsageGuide.examples.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              </Space>
                            ),
                          })
                        }}
                      />
                    ) : null}
                  </Space>
                }
              >
                <Select
                  value={props.state.type}
                  options={fieldTypeOptions}
                  disabled={props.isEdit}
                  onChange={(value) => props.onChange((prev) => changeFieldTypeState(prev, value))}
                />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} md={12}>
            <Form layout="vertical">
              <Form.Item label="展示名称" required>
                <Input value={props.state.title} onChange={(event) => props.onChange((prev) => ({ ...prev, title: event.target.value }))} />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} md={12}>
            <Form layout="vertical">
              <Form.Item label="数据库字段名" required extra="建议使用英文、小写、数字与下划线。">
                <Input value={props.state.key} onChange={(event) => props.onChange((prev) => ({ ...prev, key: event.target.value }))} />
              </Form.Item>
              {RESERVED_SYSTEM_FIELD_KEYS.includes(props.state.key.trim()) ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`字段名 ${props.state.key.trim()} 为系统保留字段，不能用于业务字段`}
                  style={{ marginTop: -8 }}
                />
              ) : null}
            </Form>
          </Col>
          {!ALL_RELATION_TYPES.includes(props.state.type) ? (
            <Col xs={24} md={12}>
              <Form layout="vertical">
                <Form.Item
                  label="默认值"
                  extra={
                    ARRAY_TYPES.includes(props.state.type)
                      ? '建议填写 JSON 数组，例如 ["a","b"]。'
                      : NUMBER_TYPES.includes(props.state.type)
                        ? '建议填写数字类型的默认值。'
                      : props.state.type === 'boolean'
                        ? '请直接选择默认值。'
                      : props.state.type === 'date'
                        ? '请填写日期，不包含时间。'
                      : props.state.type === 'datetime'
                        ? '请填写日期和时间。'
                      : props.state.type === 'json'
                        ? props.state.jsonValueType === 'object'
                          ? '建议填写合法 JSON 对象。'
                          : props.state.jsonValueType === 'array'
                            ? '建议填写合法 JSON 数组。'
                            : '建议填写合法 JSON 对象或数组。'
                      : ENUM_TYPES.includes(props.state.type)
                        ? '请从已配置的枚举选项中选择。'
                      : LOCATION_TYPES.includes(props.state.type)
                        ? '可填写经纬度，并按需补充地址和地点名称。'
                      : ADDRESS_TYPES.includes(props.state.type)
                        ? '请按当前粒度选择默认地址。'
                      : MEDIA_TYPES.includes(props.state.type)
                        ? '建议填写可直接访问的资源地址。'
                        : undefined
                  }
                >
                  {NUMBER_TYPES.includes(props.state.type) ? (
                    <InputNumber
                      style={{ width: '100%' }}
                      value={props.state.defaultValue !== '' ? Number(props.state.defaultValue) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, defaultValue: normalizeNumberInput(value) }))}
                    />
                  ) : props.state.type === 'boolean' ? (
                    <Select
                      value={props.state.defaultValue === '' ? undefined : props.state.defaultValue}
                      allowClear
                      placeholder="请选择默认值"
                      options={[
                        { label: '是', value: 'true' },
                        { label: '否', value: 'false' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, defaultValue: value ?? '' }))}
                    />
                  ) : props.state.type === 'date' ? (
                    <DatePicker
                      style={{ width: '100%' }}
                      value={parseDateValue(props.state.defaultValue)}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          defaultValue: value ? value.format('YYYY-MM-DD') : '',
                        }))
                      }
                    />
                  ) : props.state.type === 'datetime' ? (
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      value={parseDateValue(props.state.defaultValue)}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          defaultValue: value ? value.toISOString() : '',
                        }))
                      }
                    />
                  ) : LOCATION_TYPES.includes(props.state.type) ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Input
                            value={props.state.locationLng}
                            placeholder="经度，例如 121.4737"
                            onChange={(event) => props.onChange((prev) => ({ ...prev, locationLng: event.target.value }))}
                          />
                        </Col>
                        <Col span={12}>
                          <Input
                            value={props.state.locationLat}
                            placeholder="纬度，例如 31.2304"
                            onChange={(event) => props.onChange((prev) => ({ ...prev, locationLat: event.target.value }))}
                          />
                        </Col>
                      </Row>
                      <Input
                        value={props.state.locationAddress}
                        placeholder="地址，例如 上海市黄浦区人民大道"
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationAddress: event.target.value }))}
                      />
                      <Input
                        value={props.state.locationName}
                        placeholder="地点名称，例如 人民广场"
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationName: event.target.value }))}
                      />
                    </Space>
                  ) : ADDRESS_TYPES.includes(props.state.type) ? (
                    <Cascader
                      options={getChinaAreaOptionsByGranularity(props.state.addressGranularity)}
                      value={props.state.addressPath}
                      placeholder="请选择中国行政区"
                      changeOnSelect={props.state.addressGranularity !== 'district'}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          addressPath: normalizeAddressPathByGranularity(
                            Array.isArray(value) ? value.map((item) => String(item)) : [],
                            prev.addressGranularity,
                          ),
                        }))
                      }
                    />
                  ) : ARRAY_TYPES.includes(props.state.type) || props.state.type === 'json' ? (
                    <Input.TextArea
                      rows={8}
                      className="field-config-code-input"
                      value={props.state.defaultValue}
                      placeholder={
                        ARRAY_TYPES.includes(props.state.type)
                          ? '例如：["标签1","标签2"]'
                          : props.state.jsonValueType === 'array'
                            ? '例如：[{"enabled":true},{"enabled":false}]'
                            : '例如：{"enabled":true,"limit":10}'
                      }
                      onChange={(event) => props.onChange((prev) => ({ ...prev, defaultValue: event.target.value }))}
                    />
                  ) : ['textarea', 'richtext', 'markdown'].includes(props.state.type) ? (
                    <Input.TextArea
                      rows={6}
                      value={props.state.defaultValue}
                      placeholder={getLargeTextDefaultValuePlaceholder(props.state.type)}
                      onChange={(event) => props.onChange((prev) => ({ ...prev, defaultValue: event.target.value }))}
                    />
                  ) : ENUM_TYPES.includes(props.state.type) ? (
                    <Select
                      value={props.state.defaultValue === '' ? undefined : props.state.defaultValue}
                      allowClear
                      placeholder="请选择默认值"
                      options={props.state.enumOptions
                        .filter((item) => item.label.trim() && item.value.trim())
                        .map((item) => ({
                          label: `${item.label} (${item.value})`,
                          value: item.value,
                        }))}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, defaultValue: value ?? '' }))}
                    />
                  ) : (
                    <Input
                      value={props.state.defaultValue}
                      placeholder={MEDIA_TYPES.includes(props.state.type) ? getMediaDefaultValuePlaceholder(props.state.type) : undefined}
                      onChange={(event) => props.onChange((prev) => ({ ...prev, defaultValue: event.target.value }))}
                    />
                  )}
                </Form.Item>
              </Form>
            </Col>
          ) : null}
          <Col span={24}>
            <Form layout="vertical">
              <Form.Item label="描述">
                <Input.TextArea
                  rows={3}
                  value={props.state.description}
                  onChange={(event) => props.onChange((prev) => ({ ...prev, description: event.target.value }))}
                />
              </Form.Item>
            </Form>
          </Col>
        </Row>

        {TEXT_LIKE_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>文本约束</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最小长度">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      value={props.state.minLength ? Number(props.state.minLength) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, minLength: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最大长度">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      value={props.state.maxLength ? Number(props.state.maxLength) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, maxLength: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {props.state.type === 'json' ? (
          <>
            <Divider style={{ margin: '4px 0' }}>JSON 约束</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="值类型限制">
                    <Select
                      value={props.state.jsonValueType}
                      options={[
                        { label: '任意 JSON', value: 'any' },
                        { label: '仅对象', value: 'object' },
                        { label: '仅数组', value: 'array' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, jsonValueType: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {NUMBER_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>数值约束</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最小值">
                    <InputNumber
                      style={{ width: '100%' }}
                      value={props.state.minValue ? Number(props.state.minValue) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, minValue: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最大值">
                    <InputNumber
                      style={{ width: '100%' }}
                      value={props.state.maxValue ? Number(props.state.maxValue) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, maxValue: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {DATE_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>时间存储</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="存储格式" extra="用于约定该字段保存日期数据的格式。">
                    <Select
                      value={props.state.dateStorageFormat}
                      options={[
                        { label: '字符串', value: 'string' },
                        { label: '时间戳（10位）', value: 'timestamp' },
                        { label: '时间毫秒戳（13位）', value: 'timestampMs' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, dateStorageFormat: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {LOCATION_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>位置结构</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="坐标系" extra="用于约定经纬度所采用的坐标系。">
                    <Select
                      value={props.state.locationCoordinateSystem}
                      options={[
                        { label: 'GCJ-02', value: 'gcj02' },
                        { label: 'WGS84', value: 'wgs84' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, locationCoordinateSystem: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="存储模式" extra="新模型建议使用对象存储；对接已有拆分字段可使用独立字段存储。">
                    <Select
                      value={props.state.locationStorageMode}
                      options={[
                        { label: '对象存储', value: 'object' },
                        { label: '独立字段存储', value: 'flat' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, locationStorageMode: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
            {props.state.locationStorageMode === 'flat' ? (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form layout="vertical">
                    <Form.Item label="经度映射字段" required extra="填写实际保存经度的数据库字段名。">
                      <Input
                        placeholder="例如：longitude"
                        value={props.state.locationLngField}
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationLngField: event.target.value }))}
                      />
                    </Form.Item>
                  </Form>
                </Col>
                <Col xs={24} md={12}>
                  <Form layout="vertical">
                    <Form.Item label="纬度映射字段" required extra="填写实际保存纬度的数据库字段名。">
                      <Input
                        placeholder="例如：latitude"
                        value={props.state.locationLatField}
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationLatField: event.target.value }))}
                      />
                    </Form.Item>
                  </Form>
                </Col>
                <Col xs={24} md={12}>
                  <Form layout="vertical">
                    <Form.Item label="地址映射字段" extra="如需单独保存地址文本，可填写对应数据库字段名。">
                      <Input
                        placeholder="例如：address"
                        value={props.state.locationAddressField}
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationAddressField: event.target.value }))}
                      />
                    </Form.Item>
                  </Form>
                </Col>
                <Col xs={24} md={12}>
                  <Form layout="vertical">
                    <Form.Item label="地点名称映射字段" extra="如需单独保存地点名称，可填写对应数据库字段名。">
                      <Input
                        placeholder="例如：place_name"
                        value={props.state.locationNameField}
                        onChange={(event) => props.onChange((prev) => ({ ...prev, locationNameField: event.target.value }))}
                      />
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            ) : null}
            <Space wrap size={[24, 12]} className="field-config-actions-wrap">
              <Space>
                <Switch
                  checked={props.state.locationRequireAddress}
                  onChange={(checked) => props.onChange((prev) => ({ ...prev, locationRequireAddress: checked }))}
                />
                <span>要求填写地址</span>
              </Space>
              <Space>
                <Switch
                  checked={props.state.locationRequireName}
                  onChange={(checked) => props.onChange((prev) => ({ ...prev, locationRequireName: checked }))}
                />
                <span>要求填写地点名称</span>
              </Space>
            </Space>
          </>
        ) : null}

        {ADDRESS_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>地址结构</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="粒度" extra="用于控制地址字段选择到省、市或区。">
                    <Select
                      value={props.state.addressGranularity}
                      options={[
                        { label: '省', value: 'province' },
                        { label: '省 / 市', value: 'city' },
                        { label: '省 / 市 / 区', value: 'district' },
                      ]}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          addressGranularity: value,
                          addressPath: normalizeAddressPathByGranularity(prev.addressPath, value),
                        }))
                      }
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="存储模式" extra="新模型建议使用对象存储；对接已有拆分字段可使用独立字段存储。">
                    <Select
                      value={props.state.addressStorageMode}
                      options={[
                        { label: '对象存储', value: 'object' },
                        { label: '独立字段存储', value: 'flat' },
                      ]}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, addressStorageMode: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
            {props.state.addressStorageMode === 'flat' ? (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form layout="vertical">
                    <Form.Item label="省映射字段" required extra="填写实际保存省的数据库字段名。">
                      <Input
                        placeholder="例如：province"
                        value={props.state.addressProvinceField}
                        onChange={(event) => props.onChange((prev) => ({ ...prev, addressProvinceField: event.target.value }))}
                      />
                    </Form.Item>
                  </Form>
                </Col>
                {(props.state.addressGranularity === 'city' || props.state.addressGranularity === 'district') ? (
                  <Col xs={24} md={12}>
                    <Form layout="vertical">
                      <Form.Item label="市映射字段" required extra="填写实际保存市的数据库字段名。">
                        <Input
                          placeholder="例如：city"
                          value={props.state.addressCityField}
                          onChange={(event) => props.onChange((prev) => ({ ...prev, addressCityField: event.target.value }))}
                        />
                      </Form.Item>
                    </Form>
                  </Col>
                ) : null}
                {props.state.addressGranularity === 'district' ? (
                  <Col xs={24} md={12}>
                    <Form layout="vertical">
                      <Form.Item label="区映射字段" required extra="填写实际保存区的数据库字段名。">
                        <Input
                          placeholder="例如：district"
                          value={props.state.addressDistrictField}
                          onChange={(event) => props.onChange((prev) => ({ ...prev, addressDistrictField: event.target.value }))}
                        />
                      </Form.Item>
                    </Form>
                  </Col>
                ) : null}
              </Row>
            ) : null}
          </>
        ) : null}

        {ARRAY_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>数组约束</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="数组元素类型">
                    <Select
                      value={props.state.itemType}
                      options={modelCreateFieldTypeRegistry
                        .filter((item) => item.value !== 'array')
                        .map((item) => ({ label: item.label, value: item.value }))}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, itemType: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="数组说明">
                    <Typography.Text type="secondary">数组字段天然支持保存多个元素，无需额外开启多值开关。</Typography.Text>
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {RELATION_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>关联配置</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="关联模型" required>
                    <Select
                      showSearch
                      placeholder="请选择关联模型"
                      optionFilterProp="label"
                      options={relationModelOptions}
                      value={props.state.relationModelCollection}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          relationModelCollection: value,
                          relationDisplayFields: [],
                        }))
                      }
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="展示字段" required extra="可多选，顺序即后续展示顺序。">
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder={
                        props.state.relationModelCollection
                          ? '请选择一个或多个展示字段'
                          : '请先选择关联模型'
                      }
                      options={relationFieldOptions}
                      loading={props.relationFieldOptionsLoading}
                      disabled={!props.state.relationModelCollection}
                      value={props.state.relationDisplayFields}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          relationDisplayFields: Array.isArray(value) ? value.map((item) => String(item)) : [],
                        }))
                      }
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {POLY_RELATION_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>多模型关联配置</Divider>
            <Row gutter={16}>
              <Col xs={24} md={24}>
                <Form layout="vertical">
                  <Form.Item label="允许关联的模型" required extra="先选择允许关联的模型，再为每个模型分别配置展示字段。">
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="请选择一个或多个模型"
                      optionFilterProp="label"
                      options={props.relationModelOptions}
                      value={props.state.relationModelCollections}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          relationModelCollections: Array.isArray(value) ? value.map((item) => String(item)) : [],
                        }))
                      }
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
            {props.state.relationModelCollections.length > 0 ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {props.state.relationModelCollections.map((collection) => (
                  <Card
                    key={collection}
                    size="small"
                    className="field-config-relation-card"
                    title={
                      <div className="field-config-relation-card-head">
                        <div className="field-config-relation-card-title">
                          <span>{getRelationModelDisplayLabel(collection).title}</span>
                          <Typography.Text type="secondary" className="field-config-relation-card-subtitle">
                            {getRelationModelDisplayLabel(collection).subtitle}
                          </Typography.Text>
                        </div>
                        <Tag color={(props.state.polyRelationDisplayMap[collection] ?? []).length > 0 ? 'blue' : 'default'}>
                          已选 {(props.state.polyRelationDisplayMap[collection] ?? []).length} 个字段
                        </Tag>
                      </div>
                    }
                  >
                    <Form layout="vertical">
                      <Form.Item label="展示字段" required extra="这些字段会用于该模型记录的展示文案。">
                        <Select
                          mode="multiple"
                          allowClear
                          placeholder="请选择一个或多个展示字段"
                          options={[
                            ...(props.relationFieldOptionsMap?.[collection] ?? []),
                            ...(props.state.polyRelationDisplayMap[collection] ?? [])
                              .filter(
                                (fieldKey) =>
                                  fieldKey &&
                                  !(props.relationFieldOptionsMap?.[collection] ?? []).some((item) => item.value === fieldKey),
                              )
                              .map((fieldKey) => ({
                                label: `当前值（${fieldKey}）`,
                                value: fieldKey,
                              })),
                          ]}
                          loading={props.relationFieldOptionsLoading}
                          value={props.state.polyRelationDisplayMap[collection] ?? []}
                          onChange={(value) =>
                            props.onChange((prev) => ({
                              ...prev,
                              polyRelationDisplayMap: {
                                ...prev.polyRelationDisplayMap,
                                [collection]: Array.isArray(value) ? value.map((item) => String(item)) : [],
                              },
                            }))
                          }
                        />
                      </Form.Item>
                      {props.state.type === 'multiPolyRelation' ? (
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item label="最少关联数">
                              <InputNumber
                                min={0}
                                precision={0}
                                style={{ width: '100%' }}
                                value={props.state.polyRelationLimitMap[collection]?.minItems ? Number(props.state.polyRelationLimitMap[collection]?.minItems) : null}
                                onChange={(value) =>
                                  props.onChange((prev) => ({
                                    ...prev,
                                    polyRelationLimitMap: {
                                      ...prev.polyRelationLimitMap,
                                      [collection]: {
                                        minItems: normalizeNumberInput(value),
                                        maxItems: prev.polyRelationLimitMap[collection]?.maxItems ?? '',
                                      },
                                    },
                                  }))
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="最多关联数">
                              <InputNumber
                                min={0}
                                precision={0}
                                style={{ width: '100%' }}
                                value={props.state.polyRelationLimitMap[collection]?.maxItems ? Number(props.state.polyRelationLimitMap[collection]?.maxItems) : null}
                                onChange={(value) =>
                                  props.onChange((prev) => ({
                                    ...prev,
                                    polyRelationLimitMap: {
                                      ...prev.polyRelationLimitMap,
                                      [collection]: {
                                        minItems: prev.polyRelationLimitMap[collection]?.minItems ?? '',
                                        maxItems: normalizeNumberInput(value),
                                      },
                                    },
                                  }))
                                }
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      ) : null}
                    </Form>
                  </Card>
                ))}
              </Space>
            ) : null}
          </>
        ) : null}

        {ENUM_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>枚举选项</Divider>
            <Form layout="vertical" style={{ marginBottom: 12 }}>
              <Form.Item
                label="枚举值类型"
                extra={
                  props.state.enumValueType === 'number'
                    ? '落库为数字（Number）。适合对接已有数据库中存数字 ID/状态码的业务，所有选项值必须能转换为数字。'
                    : '落库为字符串（String）。新模型推荐使用字符串，兼容性更好。'
                }
              >
                <Select
                  value={props.state.enumValueType}
                  options={[
                    { label: '字符串（推荐）', value: 'string' },
                    { label: '数字', value: 'number' },
                  ]}
                  onChange={(value) =>
                    props.onChange((prev) => ({
                      ...prev,
                      enumValueType: value,
                    }))
                  }
                />
              </Form.Item>
            </Form>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {props.state.enumOptions.map((option, optionIndex) => (
                <Space key={`enum-option-${optionIndex}`} align="start" className="field-config-enum-row">
                  <Input
                    placeholder="展示名"
                    value={option.label}
                    onChange={(event) =>
                      props.onChange((prev) => ({
                        ...prev,
                        enumOptions: prev.enumOptions.map((item, index) =>
                          index === optionIndex ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Input
                    placeholder="值"
                    value={option.value}
                    onChange={(event) =>
                      props.onChange((prev) => ({
                        ...prev,
                        enumOptions: prev.enumOptions.map((item, index) =>
                          index === optionIndex ? { ...item, value: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    danger
                    onClick={() =>
                      props.onChange((prev) => ({
                        ...prev,
                        enumOptions:
                          prev.enumOptions.length === 1
                            ? [createEmptyEnumOption()]
                            : prev.enumOptions.filter((_, index) => index !== optionIndex),
                      }))
                    }
                  >
                    删除
                  </Button>
                </Space>
              ))}
              <Button
                icon={<PlusOutlined />}
                onClick={() =>
                  props.onChange((prev) => ({
                    ...prev,
                    enumOptions: [...prev.enumOptions, createEmptyEnumOption()],
                  }))
                }
              >
                添加选项
              </Button>
            </Space>
          </>
        ) : null}

        {ITEM_COUNT_TYPES.includes(props.state.type)
          && props.state.type !== 'multiPolyRelation'
          && (!MEDIA_TYPES.includes(props.state.type) || props.state.allowMultiple) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>项数约束</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最少项数">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      value={props.state.minItems ? Number(props.state.minItems) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, minItems: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="最多项数">
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%' }}
                      value={props.state.maxItems ? Number(props.state.maxItems) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, maxItems: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

        {MEDIA_TYPES.includes(props.state.type) ? (
          <>
            <Divider style={{ margin: '4px 0' }}>资源约束</Divider>
            {getAcceptPresetOptionsByType(props.state.type).length > 0 ? (
              <Space wrap size={[8, 8]}>
                {getAcceptPresetOptionsByType(props.state.type).map((preset) => (
                  <Button
                    key={preset.label}
                    size="small"
                    onClick={() =>
                      props.onChange((prev) => ({
                        ...prev,
                        acceptList: preset.values,
                      }))
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </Space>
            ) : null}
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="允许的文件类型" extra="可按常用文件类型进行多选。">
                    <Select
                      mode="multiple"
                      allowClear
                      value={props.state.acceptList}
                      options={getAcceptOptionsByType(props.state.type)}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, acceptList: value }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="单个文件大小上限（MB）" extra="请输入数字，单位为 MB。">
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      value={props.state.maxFileSizeMB ? Number(props.state.maxFileSizeMB) : null}
                      onChange={(value) => props.onChange((prev) => ({ ...prev, maxFileSizeMB: normalizeNumberInput(value) }))}
                    />
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24}>
                <Form layout="vertical">
                  <Form.Item
                    label={
                      <Space size={4}>
                        <span>资源存储格式</span>
                        {props.state.assetStorageMode === 'object' ? (
                          <Popover
                            title="资源对象存储结构"
                            trigger="hover"
                            content={
                              <div style={{ maxWidth: 360 }}>
                                <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 6, margin: 0, overflowX: 'auto' }}>
{JSON.stringify({
  fileID: 'cloud://xxx/path/to/file.png',
  path: 'path/to/file.png',
  fullPath: 'cloud://xxx/path/to/file.png',
  name: 'file.png',
  contentType: 'image/png',
  size: 102400,
}, null, 2)}
                                </pre>
                                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                                  单资源落库为上述对象，多资源落库为对象数组。size 单位为字节（Byte）。
                                </Typography.Text>
                              </div>
                            }
                          >
                            <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                          </Popover>
                        ) : null}
                      </Space>
                    }
                    extra={
                      props.state.assetStorageMode === 'url'
                        ? '落库为字符串链接；多资源时落库为字符串数组，适合兼容已有客户端只读取 URL 的场景。'
                        : '落库为资源对象；单资源为对象，多资源为对象数组。结构包含 fileID、path、fullPath、name、contentType、size。'
                    }
                  >
                    <Select
                      value={props.state.assetStorageMode}
                      options={[
                        { label: '资源对象（推荐）', value: 'object' },
                        { label: '字符串链接', value: 'url' },
                      ]}
                      onChange={(value) =>
                        props.onChange((prev) => ({
                          ...prev,
                          assetStorageMode: value,
                        }))
                      }
                    />
                  </Form.Item>
                </Form>
              </Col>
            </Row>
          </>
        ) : null}

          <Divider style={{ margin: '4px 0' }}>基础设置</Divider>
          <Space wrap size={[24, 12]} className="field-config-actions-wrap">
            {MULTI_VALUE_TYPES.includes(props.state.type) && !ARRAY_TYPES.includes(props.state.type) && MEDIA_TYPES.includes(props.state.type) ? (
              <Space>
                <Switch checked={props.state.allowMultiple} onChange={(checked) => props.onChange((prev) => ({ ...prev, allowMultiple: checked }))} />
                <span>允许多个资源上传</span>
              </Space>
            ) : null}
            <Space>
              <Switch checked={props.state.required} onChange={(checked) => props.onChange((prev) => ({ ...prev, required: checked }))} />
              <span>是否必填</span>
            </Space>
            <Space>
              <Switch checked={props.state.hidden} onChange={(checked) => props.onChange((prev) => ({ ...prev, hidden: checked }))} />
              <span>是否隐藏</span>
            </Space>
            <Space>
              <Switch
                checked={props.state.readonlyOnCreate}
                onChange={(checked) => props.onChange((prev) => ({ ...prev, readonlyOnCreate: checked }))}
              />
              <span>创建时不可修改</span>
            </Space>
            <Space>
              <Switch
                checked={props.state.readonlyOnEdit}
                onChange={(checked) => props.onChange((prev) => ({ ...prev, readonlyOnEdit: checked }))}
              />
              <span>编辑时不可修改</span>
            </Space>
            {SORTABLE_TYPES.includes(props.state.type) ? (
              <>
                <Space>
                  <Switch
                    checked={props.state.sortable}
                    onChange={(checked) =>
                      props.onChange((prev) => ({
                        ...prev,
                        sortable: checked,
                        sortDirection: prev.sortDirection || 'desc',
                      }))
                    }
                  />
                  <span>允许排序</span>
                </Space>
                {props.state.sortable ? (
                  <Select
                    value={props.state.sortDirection}
                    style={{ width: 120 }}
                    options={[
                      { label: '降序', value: 'desc' },
                      { label: '升序', value: 'asc' },
                    ]}
                    onChange={(value) => props.onChange((prev) => ({ ...prev, sortDirection: value }))}
                  />
                ) : null}
              </>
            ) : null}
          </Space>
        </Space>
      </div>
    </Modal>
  )
}
