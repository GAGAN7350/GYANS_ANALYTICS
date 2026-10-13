import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Tabs,
  Card,
  Table,
  Typography,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Progress,
  Badge,
  message,
  Tooltip,
  Select,
  theme,
} from 'antd';
import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  ClusterOutlined,
  LineChartOutlined,
  WarningOutlined,
  FileTextOutlined,
  SettingOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { datasetService, DatasetPreviewData, DatasetPatternsData } from '@/services/datasetService';
import { aiService, GeneratedReportResponse } from '@/services/aiService';
import { templateService, ReportTemplate, TemplateTier } from '@/services/templateService';
import { useUiStore } from '@/stores/uiStore';
import { Dataset } from '@/types';
import ChartBuilder from './ChartBuilder';
import TemplateStudioModal from './TemplateStudioModal';
import ReportViewer from './ReportViewer';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const isDark = useUiStore((state) => state.theme === 'dark');

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewData | null>(null);
  const [patterns, setPatterns] = useState<DatasetPatternsData | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template Studio & AI Report State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ai_report');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeReport, setActiveReport] = useState<GeneratedReportResponse | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);

  const loadTemplatesList = () => {
    templateService.list().then(setSavedTemplates).catch(() => {});
  };

  useEffect(() => {
    loadTemplatesList();
  }, []);

  // Check if user came from fresh upload (setup=true)
  useEffect(() => {
    if (searchParams.get('setup') === 'true') {
      setTemplateModalOpen(true);
    }
  }, [searchParams]);

  // Load dataset metadata on mount
  useEffect(() => {
    if (!id) return;
    setLoadingMeta(true);
    datasetService
      .get(id)
      .then((d) => {
        setDataset(d);
        if (searchParams.get('setup') !== 'true') {
          handleGenerateDefaultReport(d.id);
        }
      })
      .catch(() => setError('Dataset not found.'))
      .finally(() => setLoadingMeta(false));
  }, [id]);

  const handleGenerateDefaultReport = async (datasetId: string) => {
    setGeneratingReport(true);
    try {
      const res = await aiService.generateReport({
        dataset_id: datasetId,
        tier: 'pro',
        template_name: 'Executive Strategic Summary',
        config: {
          audience: 'executive',
          tone: 'action_oriented',
          sections: ['summary', 'anomalies', 'root_causes', 'forecast', 'actions'],
        },
      });
      setActiveReport(res);
    } catch {
      // Fallback
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleApplyTemplate = async (
    config: Record<string, any>,
    templateName: string,
    tier: TemplateTier
  ) => {
    if (!id) return;
    setGeneratingReport(true);
    setActiveTab('ai_report');
    setFeedback(null);
    try {
      const res = await aiService.generateReport({
        dataset_id: id,
        tier: tier,
        template_name: templateName,
        config: config,
      });
      setActiveReport(res);
      message.success(`Generated ${tier.toUpperCase()} report.`);
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? 'Failed to generate report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (!id) return;
    if (key === 'preview' && !preview) {
      setLoadingPreview(true);
      datasetService
        .preview(id, 100)
        .then(setPreview)
        .catch(() => setError('Failed to load preview.'))
        .finally(() => setLoadingPreview(false));
    }
    if (key === 'patterns' && !patterns) {
      setLoadingPatterns(true);
      datasetService
        .patterns(id)
        .then(setPatterns)
        .catch(() => setError('Failed to load patterns.'))
        .finally(() => setLoadingPatterns(false));
    }
  };

  const handleCopyMarkdown = () => {
    if (activeReport?.markdown) {
      navigator.clipboard.writeText(activeReport.markdown);
      message.success('Report markdown copied to clipboard.');
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    message.success('Feedback recorded.');
  };

  if (loadingMeta) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <Spin size="large" tip="Loading dataset..." />
      </div>
    );
  }

  if (error || !dataset || !id) {
    return (
      <Alert
        type="error"
        message={error ?? 'Dataset not found'}
        action={<Button onClick={() => navigate('/datasets')}>Back to Datasets</Button>}
        showIcon
      />
    );
  }

  const health = (dataset as any).connectionConfig?.health;
  const healthScore = health?.health_score ?? null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#0d9488';
    if (score >= 60) return '#0284c7';
    return '#475569';
  };

  const allColumns = (dataset.columns ?? []).map((c: any) => c.name);
  const numericColumns = (dataset.columns ?? [])
    .filter((c: any) => c.dataType === 'number')
    .map((c: any) => c.name);

  const origFilename = (dataset as any)?.connectionConfig?.original_filename || dataset.name || '';
  const datasetFormat = origFilename.includes('.') ? ('.' + origFilename.split('.').pop().toLowerCase()) : '.csv';

  const checkCompatibility = (t: ReportTemplate): { compatible: boolean; reason: string } => {
    if (t.isPreset) return { compatible: true, reason: '' };
    const tf = t.config?.source_format;
    const tc: string[] = t.config?.required_columns || [];

    if (tf && datasetFormat) {
      const normTf = tf.startsWith('.') ? tf.toLowerCase() : `.${tf.toLowerCase()}`;
      const normDf = datasetFormat.startsWith('.') ? datasetFormat.toLowerCase() : `.${datasetFormat.toLowerCase()}`;
      if (normTf !== normDf) {
        return {
          compatible: false,
          reason: `Requires ${normTf.toUpperCase()} (current is ${normDf.toUpperCase()})`,
        };
      }
    }

    if (tc.length > 0 && allColumns.length > 0) {
      const missing = tc.filter((c: string) => !allColumns.includes(c));
      if (missing.length > 0) {
        return {
          compatible: false,
          reason: `Missing column: ${missing.join(', ')}`,
        };
      }
    }

    return { compatible: true, reason: '' };
  };

  const handleQuickApply = (templateId: string) => {
    const tmpl = savedTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const compat = checkCompatibility(tmpl);
    if (!compat.compatible) {
      message.error(`Cannot apply template: ${compat.reason}`);
      return;
    }
    handleApplyTemplate(tmpl.config || {}, tmpl.name, tmpl.tier);
  };

  return (
    <div style={{ padding: '0 24px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="link"
          onClick={() => navigate('/datasets')}
          style={{ paddingLeft: 0, marginBottom: 8, color: isDark ? '#94a3b8' : '#475569' }}
        >
          Back to Datasets
        </Button>
        <Row align="middle" justify="space-between">
          <Col>
            <Space align="start">
              <DatabaseOutlined style={{ fontSize: 24, color: isDark ? '#60a5fa' : '#1e293b' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  {dataset.name}
                </Title>
                <Text type="secondary">{dataset.description}</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                style={{ width: 260 }}
                placeholder="Apply Saved Template..."
                onChange={handleQuickApply}
                allowClear
              >
                {savedTemplates.filter((t) => !t.isPreset).length > 0 && (
                  <Select.OptGroup label="Your Saved Templates">
                    {savedTemplates
                      .filter((t) => !t.isPreset)
                      .map((t) => {
                        const compat = checkCompatibility(t);
                        return (
                          <Option key={t.id} value={t.id} disabled={!compat.compatible}>
                            <Space size={4}>
                              <span style={{ color: compat.compatible ? 'inherit' : '#94a3b8' }}>
                                {t.name}
                              </span>
                              {t.config?.source_format && (
                                <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, background: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#94a3b8' : '#475569' }}>
                                  {t.config.source_format.replace('.', '').toUpperCase()}
                                </Tag>
                              )}
                              {!compat.compatible && (
                                <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, color: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca' }}>
                                  {compat.reason}
                                </Tag>
                              )}
                            </Space>
                          </Option>
                        );
                      })}
                  </Select.OptGroup>
                )}
                <Select.OptGroup label="System Presets">
                  {savedTemplates
                    .filter((t) => t.isPreset)
                    .map((t) => (
                      <Option key={t.id} value={t.id}>
                        {t.name}
                      </Option>
                    ))}
                </Select.OptGroup>
              </Select>
              <Button
                type="primary"
                size="middle"
                icon={<SettingOutlined />}
                style={{
                  background: isDark ? '#2563eb' : '#0f172a',
                  borderColor: isDark ? '#2563eb' : '#0f172a',
                  fontWeight: 500,
                }}
                onClick={() => setTemplateModalOpen(true)}
              >
                Configure Analysis
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Quick stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Rows" value={dataset.rowCount?.toLocaleString() ?? '—'} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Columns" value={dataset.columns?.length ?? '—'} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title="Format"
              value={
                (dataset as any).connectionConfig?.original_filename
                  ?.split('.')
                  .pop()
                  ?.toUpperCase() ?? 'FILE'
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            {healthScore !== null ? (
              <>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>Data Health Score</div>
                <Progress
                  type="circle"
                  percent={healthScore}
                  width={60}
                  strokeColor={getHealthColor(healthScore)}
                  format={(p) => `${p}`}
                />
              </>
            ) : (
              <Statistic title="Data Health" value="—" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Tabbed content */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'ai_report',
            label: (
              <Space>
                <FileTextOutlined style={{ color: isDark ? '#60a5fa' : '#2563eb' }} />
                <span style={{ fontWeight: 500 }}>Analysis Report</span>
                {activeReport && (
                  <Tag
                    style={{
                      background: isDark ? '#1e293b' : '#f8fafc',
                      color: isDark ? '#93c5fd' : '#334155',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      fontWeight: 500,
                    }}
                  >
                    {activeReport.tier === 'beginner'
                      ? 'Beginner'
                      : activeReport.tier === 'pro'
                      ? 'Pro Strategy'
                      : 'Ultra Pro Quant'}
                  </Tag>
                )}
              </Space>
            ),
            children: generatingReport ? (
              <div style={{ textAlign: 'center', padding: 80 }}>
                <Spin size="large" tip="Computing multi-level analysis..." />
              </div>
            ) : activeReport ? (
              <Card
                title={
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Space>
                        <FileTextOutlined style={{ color: isDark ? '#60a5fa' : '#2563eb' }} />
                        <span style={{ fontWeight: 600 }}>{activeReport.reportTitle}</span>
                        {activeReport.trafficStatus && (
                          <Tag style={{ background: isDark ? '#1e293b' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', borderColor: isDark ? '#334155' : '#cbd5e1' }}>
                            Status: {activeReport.trafficStatus}
                          </Tag>
                        )}
                      </Space>
                    </Col>
                    <Col>
                      <Space>
                        <Tooltip title="Copy full report as Markdown">
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={handleCopyMarkdown}
                          >
                            Copy Markdown
                          </Button>
                        </Tooltip>
                        <Button
                          size="small"
                          type="primary"
                          icon={<SettingOutlined />}
                          style={{ background: isDark ? '#2563eb' : '#0f172a', borderColor: isDark ? '#2563eb' : '#0f172a' }}
                          onClick={() => setTemplateModalOpen(true)}
                        >
                          Change Configuration
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                }
              >
                {/* Formatted Theme-Aware Report Viewer */}
                <ReportViewer
                  markdown={activeReport.markdown}
                  tier={activeReport.tier}
                />

                {/* Telemetry / Quality Feedback Bar */}
                <Card
                  size="small"
                  style={{
                    marginTop: 20,
                    background: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: 6
                  }}
                >
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Was this report accurate and actionable?
                      </Text>
                    </Col>
                    <Col>
                      <Space>
                        <Button
                          size="small"
                          icon={<LikeOutlined />}
                          type={feedback === 'up' ? 'primary' : 'default'}
                          onClick={() => handleFeedback('up')}
                        >
                          Accurate
                        </Button>
                        <Button
                          size="small"
                          icon={<DislikeOutlined />}
                          type={feedback === 'down' ? 'primary' : 'default'}
                          onClick={() => handleFeedback('down')}
                        >
                          Needs Adjustment
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
              </Card>
            ) : (
              <Card style={{ textAlign: 'center', padding: 60 }}>
                <FileTextOutlined style={{ fontSize: 40, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 16 }} />
                <Title level={4}>No Report Generated Yet</Title>
                <Paragraph type="secondary">
                  Open the Configuration Studio to select an analysis mode and run intelligence reporting.
                </Paragraph>
                <Button
                  type="primary"
                  size="middle"
                  icon={<SettingOutlined />}
                  style={{ background: isDark ? '#2563eb' : '#0f172a', borderColor: isDark ? '#2563eb' : '#0f172a' }}
                  onClick={() => setTemplateModalOpen(true)}
                >
                  Configure Analysis
                </Button>
              </Card>
            ),
          },
          {
            key: 'chart',
            label: (
              <Space>
                <BarChartOutlined />
                Chart Builder
              </Space>
            ),
            children: <ChartBuilder datasetId={id} />,
          },
          {
            key: 'preview',
            label: (
              <Space>
                <DatabaseOutlined />
                Data Preview
              </Space>
            ),
            children: loadingPreview ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin tip="Loading data..." />
              </div>
            ) : preview ? (
              <Card style={{ borderColor: '#e2e8f0' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">
                    Showing {preview.preview_count} of {preview.total_rows.toLocaleString()} rows
                  </Text>
                </div>
                <Table
                  dataSource={preview.rows.map((row, i) => ({ ...row, _key: i }))}
                  rowKey="_key"
                  columns={preview.columns.map((col) => ({
                    title: col.name,
                    dataIndex: col.name,
                    key: col.name,
                    ellipsis: true,
                    width: 150,
                    render: (val: any) =>
                      val === null || val === undefined ? (
                        <Text type="secondary" italic>
                          null
                        </Text>
                      ) : (
                        String(val)
                      ),
                  }))}
                  scroll={{ x: true, y: 400 }}
                  size="small"
                  pagination={false}
                  bordered
                />
              </Card>
            ) : (
              <Alert message="Click the tab to load data preview." type="info" showIcon />
            ),
          },
          {
            key: 'patterns',
            label: (
              <Space>
                <ThunderboltOutlined />
                ML Patterns
              </Space>
            ),
            children: loadingPatterns ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin tip="Running ML analysis..." />
              </div>
            ) : patterns ? (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {patterns.patterns?.anomalies && (
                  <Card
                    title={
                      <Space>
                        <WarningOutlined style={{ color: '#475569' }} />
                        Anomalies
                      </Space>
                    }
                    size="small"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    {patterns.patterns.anomalies.detected ? (
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic
                            title="Anomalous Rows"
                            value={patterns.patterns.anomalies.anomaly_count}
                            suffix={`(${patterns.patterns.anomalies.anomaly_percentage.toFixed(1)}%)`}
                            valueStyle={{ color: '#334155' }}
                          />
                        </Col>
                        <Col span={16}>
                          <Text type="secondary">Columns analysed: </Text>
                          {patterns.patterns.anomalies.evaluated_columns.map((c) => (
                            <Tag key={c}>{c}</Tag>
                          ))}
                        </Col>
                      </Row>
                    ) : (
                      <Badge status="success" text="No anomalies detected." />
                    )}
                  </Card>
                )}

                {patterns.patterns?.clusters && (
                  <Card
                    title={
                      <Space>
                        <ClusterOutlined style={{ color: '#475569' }} />
                        Clusters
                      </Space>
                    }
                    size="small"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    {patterns.patterns.clusters.clustered ? (
                      <Space wrap>
                        {patterns.patterns.clusters.clusters.map((cl) => (
                          <Card
                            key={cl.cluster_id}
                            size="small"
                            style={{ minWidth: 160, borderColor: '#cbd5e1' }}
                          >
                            <Text strong>{cl.name}</Text>
                            <br />
                            <Text type="secondary">
                              {cl.size} rows ({cl.percentage.toFixed(1)}%)
                            </Text>
                          </Card>
                        ))}
                      </Space>
                    ) : (
                      <Text type="secondary">Not enough numeric columns for clustering.</Text>
                    )}
                  </Card>
                )}

                {patterns.patterns?.correlations && (
                  <Card
                    title={
                      <Space>
                        <LineChartOutlined style={{ color: '#475569' }} />
                        Key Correlations
                      </Space>
                    }
                    size="small"
                    style={{ borderColor: '#e2e8f0' }}
                  >
                    {patterns.patterns.correlations.has_correlations ? (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={patterns.patterns.correlations.top_drivers.map((d, i) => ({
                          ...d,
                          key: i,
                        }))}
                        columns={[
                          { title: 'Feature A', dataIndex: 'feature_a' },
                          { title: 'Feature B', dataIndex: 'feature_b' },
                          {
                            title: 'Correlation',
                            dataIndex: 'correlation',
                            render: (val: number) => (
                              <Tag style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                                r = {val.toFixed(3)}
                              </Tag>
                            ),
                          },
                          { title: 'Strength', dataIndex: 'strength' },
                          { title: 'Relationship', dataIndex: 'relationship' },
                        ]}
                      />
                    ) : (
                      <Text type="secondary">No significant correlations found.</Text>
                    )}
                  </Card>
                )}
              </Space>
            ) : (
              <Alert message="Click the tab to run ML pattern analysis." type="info" showIcon />
            ),
          },
          {
            key: 'columns',
            label: 'Columns',
            children: (
              <Card style={{ borderColor: '#e2e8f0' }}>
                <Table
                  dataSource={(dataset.columns ?? []).map((c: any, i: number) => ({ ...c, key: i }))}
                  columns={[
                    { title: 'Column Name', dataIndex: 'name', key: 'name' },
                    {
                      title: 'Type',
                      dataIndex: 'dataType',
                      key: 'dataType',
                      render: (t: string) => (
                        <Tag style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}>
                          {t}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Nullable',
                      dataIndex: 'isNullable',
                      key: 'isNullable',
                      render: (v: boolean) => (v ? <Tag>Yes</Tag> : <Tag>No</Tag>),
                    },
                    {
                      title: 'Sample Values',
                      dataIndex: 'sampleValues',
                      key: 'sampleValues',
                      render: (vals: string[]) => (
                        <Space wrap>
                          {(vals ?? []).slice(0, 3).map((v, i) => (
                            <Tag key={i}>{v}</Tag>
                          ))}
                        </Space>
                      ),
                    },
                  ]}
                  size="small"
                  pagination={false}
                  bordered
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Template Studio Modal */}
      <TemplateStudioModal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          loadTemplatesList();
        }}
        onApplyTemplate={handleApplyTemplate}
        datasetFormat={datasetFormat}
        datasetColumns={allColumns}
        numericColumns={numericColumns}
        datasetName={dataset.name}
      />
    </div>
  );
};

export default DatasetDetailPage;
