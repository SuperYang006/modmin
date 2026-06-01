import { Button, Collapse, Popover, Select, Space, Switch, Typography } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import type { SystemFieldSettings } from '@/types/schema'

interface SystemFieldSettingsCardProps {
  value: SystemFieldSettings
  onChange: (updater: (prev: SystemFieldSettings) => SystemFieldSettings) => void
}

export function SystemFieldSettingsCard(props: SystemFieldSettingsCardProps) {
  const value = props.value

  const helpContent = (
    <Space orientation="vertical" size={8} style={{ width: 320 }}>
      <Typography.Text type="secondary" className="model-system-field-desc">
        CMS 自动维护这些字段，用于记录创建、更新和删除信息，避免与业务字段重名。
      </Typography.Text>
      <Typography.Text type="secondary" className="model-system-field-desc">
        <strong>_id</strong> 为云数据库自动生成的文档主键，属于内建系统字段，无需在模型中单独配置。
      </Typography.Text>
      <div className="model-system-field-help-list">
        <div><strong>modmin_createTime</strong>：记录创建时间</div>
        <div><strong>modmin_createBy</strong>：记录创建人</div>
        <div><strong>modmin_updateTime</strong>：记录最后一次更新时间</div>
        <div><strong>modmin_updateBy</strong>：记录最后一次更新人</div>
        <div><strong>modmin_isDeleted</strong>：是否已软删除</div>
        <div><strong>modmin_deleteTime</strong>：软删除发生的时间</div>
        <div><strong>modmin_deleteBy</strong>：执行软删除的人</div>
      </div>
    </Space>
  )

  return (
    <Collapse
      className="model-system-field-collapse"
      size="small"
      defaultActiveKey={[]}
      items={[
        {
          key: 'system',
          label: (
            <Space size={6}>
              <span>系统字段</span>
              <Popover content={helpContent} trigger="hover" placement="rightTop" classNames={{ root: 'model-system-field-popover' }}>
                <Button
                  type="text"
                  size="small"
                  className="model-system-field-help"
                  icon={<QuestionCircleOutlined />}
                  onClick={(event) => event.stopPropagation()}
                />
              </Popover>
            </Space>
          ),
          children: (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <div className="model-system-field-grid">
                <div className="model-system-field-item">
                  <span>列表显示文档 ID</span>
                  <Switch
                    checked={value.showIdInList !== false}
                    onChange={(checked) =>
                      props.onChange((prev) => ({
                        ...prev,
                        showIdInList: checked,
                      }))
                    }
                  />
                </div>

                <div className="model-system-field-item">
                  <span>显示系统创建时间</span>
                  <Switch
                    checked={value.showCmsCreateTime !== false}
                    onChange={(checked) =>
                      props.onChange((prev) => ({
                        ...prev,
                        showCmsCreateTime: checked,
                      }))
                    }
                  />
                </div>

                <div className="model-system-field-item">
                  <span>显示系统更新时间</span>
                  <Switch
                    checked={value.showCmsUpdateTime === true}
                    onChange={(checked) =>
                      props.onChange((prev) => ({
                        ...prev,
                        showCmsUpdateTime: checked,
                      }))
                    }
                  />
                </div>

                <div className="model-system-field-item model-system-field-item-select">
                  <span>默认排序字段</span>
                  <Select
                    value={value.defaultSortField || 'modmin_createTime'}
                    options={[
                      { label: '创建时间', value: 'modmin_createTime' },
                      { label: '更新时间', value: 'modmin_updateTime' },
                    ]}
                    onChange={(nextValue) =>
                      props.onChange((prev) => ({
                        ...prev,
                        defaultSortField: nextValue,
                      }))
                    }
                  />
                </div>

                <div className="model-system-field-item model-system-field-item-select">
                  <span>默认排序方向</span>
                  <Select
                    value={value.defaultSortOrder || 'desc'}
                    options={[
                      { label: '降序', value: 'desc' },
                      { label: '升序', value: 'asc' },
                    ]}
                    onChange={(nextValue) =>
                      props.onChange((prev) => ({
                        ...prev,
                        defaultSortOrder: nextValue,
                      }))
                    }
                  />
                </div>
              </div>
            </Space>
          ),
        },
      ]}
    />
  )
}
