import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Card,
  Select,
  Input,
  Radio,
  Checkbox,
  Slider,
  Switch,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Alert,
  message,
  Divider,
  Tooltip,
  theme,
} from 'antd';
import {
  SaveOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  SlidersOutlined,
  ExperimentOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { templateService, ReportTemplate, TemplateTier } from '@/services/templateService';
import { useUiStore } from '@/stores/uiStore';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface TemplateStudioModalProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (templateConfig: Record<string, any>, templateName: string, tier: TemplateTier) => void;
  datasetFormat?: string;
  datasetColumns?: string[];
  numericColumns?: string[];
  datasetName?: string;
}

const DOMAIN_OPTIONS = [
  { value: 'auto', label: 'Auto-Detect from Data' },
  { value: 'religious', label: 'Religious & Non-Profit Organizations' },
  { value: 'business', label: 'Business, Retail & E-Commerce' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'education', label: 'Education & Academics' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'hr', label: 'HR & Workforce' },
  { value: 'agriculture', label: 'Agriculture & Farming' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'sports', label: 'Sports & Athletics' },
];

const TemplateStudioModal: React.FC<TemplateStudioModalProps> = ({
  open,
  onClose,
  onApplyTemplate,
  datasetFormat = '',
  datasetColumns = [],
  numericColumns = [],
  datasetName = '',
}) => {
  const { token } = theme.useToken();
  const isDark = useUiStore((state) => state.theme === 'dark');

  const [activeTier, setActiveTier] = useState<TemplateTier>('beginner');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateDesc, setNewTemplateDesc] = useState<string>('');

  // Beginner State
  const [beginnerDomain, setBeginnerDomain] = useState<string>('auto');
  const [beginnerIntent, setBeginnerIntent] = useState<'summary' | 'growth' | 'risks'>('summary');
  const [beginnerQuestion, setBeginnerQuestion] = useState<string>('');

  // Pro State
  const [proDomain, setProDomain] = useState<string>('auto');
  const [proTargetKpi, setProTargetKpi] = useState<string | undefined>(numericColumns[0]);
  const [proGoalDirection, setProGoalDirection] = useState<string>('maximize');
  const [proAudience, setProAudience] = useState<string>('executive');
  const [proTone, setProTone] = useState<string>('action_oriented');
  const [proSections, setProSections] = useState<string[]>([
    'summary',
    'anomalies',
    'root_causes',
    'forecast',
    'actions',
  ]);
  const [proNotes, setProNotes] = useState<string>('');

  // Ultra Pro State (Deep Slate / Indigo theme, strictly no red)
  const [ultraDomain, setUltraDomain] = useState<string>('auto');
  const [ultraTargetKpi, setUltraTargetKpi] = useState<string | undefined>(numericColumns[0]);
  const [ultraAnomalyAlgo, setUltraAnomalyAlgo] = useState<string>('isolation_forest');
  const [ultraContamination, setUltraContamination] = useState<number>(0.02);
  const [ultraCorrMethod, setUltraCorrMethod] = useState<string>('spearman');
  const [ultraCorrThreshold, setUltraCorrThreshold] = useState<number>(0.5);
  const [ultraClusterK, setUltraClusterK] = useState<string>('auto');
  const [ultraConfidence, setUltraConfidence] = useState<number>(0.95);
  const [ultraLatexFormulas, setUltraLatexFormulas] = useState<boolean>(true);

  // Load templates on open
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      const list = await templateService.list();
      setTemplates(list);
    } catch {
      // Fallback
    }
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await templateService.delete(templateId);
      message.success('Template deleted.');
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(undefined);
      }
      loadTemplates();
    } catch {
      message.error('Failed to delete template.');
    }
  };

  const checkCompatibility = (t: ReportTemplate): { compatible: boolean; reason: string } => {
    // System presets are universal and adaptable
    if (t.isPreset) return { compatible: true, reason: '' };

    const tf = t.config?.source_format;
    const tc: string[] = t.config?.required_columns || [];

    // Format check
    if (tf && datasetFormat) {
      const normTf = tf.startsWith('.') ? tf.toLowerCase() : `.${tf.toLowerCase()}`;
      const normDf = datasetFormat.startsWith('.') ? datasetFormat.toLowerCase() : `.${datasetFormat.toLowerCase()}`;
      if (normTf !== normDf) {
        return {
          compatible: false,
          reason: `Requires ${normTf.toUpperCase()} file (current is ${normDf.toUpperCase()})`,
        };
      }
    }

    // Required columns check
    if (tc.length > 0 && datasetColumns.length > 0) {
      const missing = tc.filter((c: string) => !datasetColumns.includes(c));
      if (missing.length > 0) {
        return {
          compatible: false,
          reason: `Missing required column: ${missing.join(', ')}`,
        };
      }
    }

    return { compatible: true, reason: '' };
  };

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) {
      setSelectedTemplateId(undefined);
      return;
    }

    const { compatible, reason } = checkCompatibility(tmpl);
    if (!compatible) {
      message.error(`Cannot select template: ${reason}`);
      return;
    }

    setSelectedTemplateId(templateId);

    if (tmpl.tier !== activeTier) {
      setActiveTier(tmpl.tier);
    }

    const c = tmpl.config || {};
    if (tmpl.tier === 'beginner') {
      if (tmpl.domain) setBeginnerDomain(tmpl.domain);
      if (c.intent) setBeginnerIntent(c.intent);
      if (c.custom_question) setBeginnerQuestion(c.custom_question);
    } else if (tmpl.tier === 'pro') {
      if (tmpl.domain) setProDomain(tmpl.domain);
      if (c.target_kpi) setProTargetKpi(c.target_kpi);
      if (c.goal_direction) setProGoalDirection(c.goal_direction);
      if (c.audience) setProAudience(c.audience);
      if (c.tone) setProTone(c.tone);
      if (c.sections) setProSections(c.sections);
      if (c.notes) setProNotes(c.notes);
    } else if (tmpl.tier === 'ultra_pro') {
      if (tmpl.domain) setUltraDomain(tmpl.domain);
      if (c.target_kpi) setUltraTargetKpi(c.target_kpi);
      if (c.anomaly_algorithm) setUltraAnomalyAlgo(c.anomaly_algorithm);
      if (c.anomaly_contamination) setUltraContamination(c.anomaly_contamination);
      if (c.correlation_method) setUltraCorrMethod(c.correlation_method);
      if (c.correlation_threshold) setUltraCorrThreshold(c.correlation_threshold);
      if (c.cluster_algorithm) setUltraClusterK(c.cluster_algorithm);
      if (c.forecast_confidence) setUltraConfidence(c.forecast_confidence);
      if (c.latex_formulas !== undefined) setUltraLatexFormulas(c.latex_formulas);
    }
    message.success(`Loaded template: ${tmpl.name}`);
  };

  const getCurrentConfig = (): { config: Record<string, any>; domain: string; name: string } => {
    const reqCols: string[] = [];
    if (activeTier === 'pro' && proTargetKpi) {
      reqCols.push(proTargetKpi);
    } else if (activeTier === 'ultra_pro' && ultraTargetKpi) {
      reqCols.push(ultraTargetKpi);
    }

    const baseMeta = {
      source_format: datasetFormat ? (datasetFormat.startsWith('.') ? datasetFormat.toLowerCase() : `.${datasetFormat.toLowerCase()}`) : undefined,
      source_dataset: datasetName || undefined,
      required_columns: reqCols,
    };

    if (activeTier === 'beginner') {
      return {
        name: `Beginner Brief (${beginnerIntent.toUpperCase()})`,
        domain: beginnerDomain,
        config: {
          ...baseMeta,
          tier: 'beginner',
          intent: beginnerIntent,
          custom_question: beginnerQuestion,
          traffic_lights: true,
          action_items_count: 3,
        },
      };
    } else if (activeTier === 'pro') {
      return {
        name: `Pro Strategy (${proAudience})`,
        domain: proDomain,
        config: {
          ...baseMeta,
          tier: 'pro',
          target_kpi: proTargetKpi,
          goal_direction: proGoalDirection,
          audience: proAudience,
          tone: proTone,
          sections: proSections,
          notes: proNotes,
        },
      };
    } else {
      return {
        name: `Ultra Pro Quant Audit (${ultraAnomalyAlgo})`,
        domain: ultraDomain,
        config: {
          ...baseMeta,
          tier: 'ultra_pro',
          target_kpi: ultraTargetKpi,
          anomaly_algorithm: ultraAnomalyAlgo,
          anomaly_contamination: ultraContamination,
          correlation_method: ultraCorrMethod,
          correlation_threshold: ultraCorrThreshold,
          cluster_k: ultraClusterK,
          forecast_confidence: ultraConfidence,
          latex_formulas: ultraLatexFormulas,
          output_depth: 'quant_audit',
        },
      };
    }
  };

  const handleApply = () => {
    const { config, name } = getCurrentConfig();
    onApplyTemplate(config, name, activeTier);
    onClose();
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      message.error('Please enter a template name.');
      return;
    }
    setSavingTemplate(true);
    try {
      const { config, domain } = getCurrentConfig();
      await templateService.create({
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim() || undefined,
        tier: activeTier,
        domain: domain,
        config: config,
      });
      message.success('Template saved successfully!');
      setSaveModalOpen(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      loadTemplates();
    } catch {
      message.error('Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={850}
        title={
          <Space>
            <SettingOutlined style={{ color: isDark ? '#60a5fa' : '#2563eb', fontSize: 18 }} />
            <Title level={4} style={{ margin: 0 }}>
              Analysis Configuration Studio
            </Title>
            <Tag style={{ background: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#94a3b8' : '#475569', borderColor: isDark ? '#334155' : '#cbd5e1' }}>
              Standardized Modes
            </Tag>
          </Space>
        }
        footer={[
          <Button key="cancel" onClick={onClose}>
            Cancel
          </Button>,
          <Button
            key="save"
            icon={<SaveOutlined />}
            onClick={() => setSaveModalOpen(true)}
          >
            Save as Template
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<CheckCircleOutlined />}
            style={{ background: isDark ? '#2563eb' : '#0f172a', borderColor: isDark ? '#2563eb' : '#0f172a' }}
            onClick={handleApply}
          >
            Run Analysis
          </Button>,
        ]}
      >
        {/* Tier Switcher Tabs */}
        <Tabs
          activeKey={activeTier}
          onChange={(key) => {
            setActiveTier(key as TemplateTier);
            setSelectedTemplateId(undefined);
          }}
          type="card"
          items={[
            {
              key: 'beginner',
              label: (
                <Space>
                  <ThunderboltOutlined style={{ color: '#0284c7' }} />
                  <span style={{ fontWeight: 500 }}>Beginner</span>
                </Space>
              ),
            },
            {
              key: 'pro',
              label: (
                <Space>
                  <SlidersOutlined style={{ color: '#2563eb' }} />
                  <span style={{ fontWeight: 500 }}>Pro Strategy</span>
                </Space>
              ),
            },
            {
              key: 'ultra_pro',
              label: (
                <Space>
                  <ExperimentOutlined style={{ color: '#4f46e5' }} />
                  <span style={{ fontWeight: 500 }}>Ultra Pro Quant</span>
                </Space>
              ),
            },
          ]}
        />

        {/* Saved Templates Quick Select */}
        <div style={{ margin: '16px 0', padding: 12, background: isDark ? '#1e293b' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 6 }}>
          <Row align="middle" gutter={16}>
            <Col flex="none">
              <Space>
                <FolderOpenOutlined style={{ color: isDark ? '#94a3b8' : '#475569' }} />
                <Text strong>Preset / Saved Template:</Text>
              </Space>
            </Col>
            <Col flex="auto">
              <Select
                style={{ width: '100%' }}
                placeholder="Select a saved template or preset..."
                value={selectedTemplateId}
                onChange={handleSelectTemplate}
                allowClear
              >
                {templates.filter((t) => !t.isPreset).length > 0 && (
                  <Select.OptGroup label="Your Custom Saved Templates">
                    {templates
                      .filter((t) => !t.isPreset)
                      .map((t) => {
                        const compat = checkCompatibility(t);
                        return (
                          <Option key={t.id} value={t.id} disabled={!compat.compatible}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space size={6}>
                                <span style={{ color: compat.compatible ? 'inherit' : '#94a3b8' }}>
                                  <strong>{t.name}</strong> ({t.tier.toUpperCase()})
                                </span>
                                {t.config?.source_format && (
                                  <Tag style={{ fontSize: 11, padding: '0 4px', margin: 0, background: isDark ? '#0f172a' : '#f1f5f9', color: isDark ? '#94a3b8' : '#475569' }}>
                                    {t.config.source_format.replace('.', '').toUpperCase()}
                                  </Tag>
                                )}
                                {!compat.compatible && (
                                  <Tag style={{ fontSize: 11, padding: '0 4px', margin: 0, color: '#ef4444', background: isDark ? '#450a0a' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca' }}>
                                    {compat.reason}
                                  </Tag>
                                )}
                              </Space>
                              <Tooltip title="Delete saved template">
                                <DeleteOutlined
                                  style={{ color: '#94a3b8', padding: '2px 6px' }}
                                  onClick={(e) => handleDeleteTemplate(t.id, e)}
                                />
                              </Tooltip>
                            </div>
                          </Option>
                        );
                      })}
                  </Select.OptGroup>
                )}
                <Select.OptGroup label="System Presets">
                  {templates
                    .filter((t) => t.isPreset)
                    .map((t) => (
                      <Option key={t.id} value={t.id}>
                        <strong>{t.name}</strong> ({t.tier.toUpperCase()}) — {t.description}
                      </Option>
                    ))}
                </Select.OptGroup>
              </Select>
            </Col>
          </Row>
        </div>

        {/* ── BEGINNER VIEW ────────────────────────────────────── */}
        {activeTier === 'beginner' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              message="Beginner Mode: Plain Language Output"
              description="Clear status indicators, conversational narrative, and 3 immediate action steps."
              type="info"
              showIcon
              style={isDark ? { background: '#082f49', borderColor: '#0284c7', color: '#e0f2fe' } : { background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}
            />

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                1. Domain Classification
              </Text>
              <Select
                style={{ width: '100%' }}
                value={beginnerDomain}
                onChange={setBeginnerDomain}
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <Option key={d.value} value={d.value}>
                    {d.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                2. Primary Analysis Focus
              </Text>
              <Row gutter={12}>
                <Col span={8}>
                  <Card
                    hoverable
                    onClick={() => setBeginnerIntent('summary')}
                    style={{
                      borderColor: beginnerIntent === 'summary' ? '#0284c7' : isDark ? '#334155' : '#e2e8f0',
                      borderWidth: beginnerIntent === 'summary' ? 2 : 1,
                      textAlign: 'center',
                      background: beginnerIntent === 'summary' ? (isDark ? '#0c4a6e' : '#f0f9ff') : (isDark ? '#1e293b' : '#ffffff'),
                    }}
                  >
                    <Title level={5} style={{ margin: 0 }}>Standard Brief</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      System overview & status indicators.
                    </Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card
                    hoverable
                    onClick={() => setBeginnerIntent('growth')}
                    style={{
                      borderColor: beginnerIntent === 'growth' ? '#0284c7' : isDark ? '#334155' : '#e2e8f0',
                      borderWidth: beginnerIntent === 'growth' ? 2 : 1,
                      textAlign: 'center',
                      background: beginnerIntent === 'growth' ? (isDark ? '#0c4a6e' : '#f0f9ff') : (isDark ? '#1e293b' : '#ffffff'),
                    }}
                  >
                    <Title level={5} style={{ margin: 0 }}>Growth & Opportunity</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      High-performing segments and positive trends.
                    </Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card
                    hoverable
                    onClick={() => setBeginnerIntent('risks')}
                    style={{
                      borderColor: beginnerIntent === 'risks' ? '#0284c7' : isDark ? '#334155' : '#e2e8f0',
                      borderWidth: beginnerIntent === 'risks' ? 2 : 1,
                      textAlign: 'center',
                      background: beginnerIntent === 'risks' ? (isDark ? '#0c4a6e' : '#f0f9ff') : (isDark ? '#1e293b' : '#ffffff'),
                    }}
                  >
                    <Title level={5} style={{ margin: 0 }}>Risk & Anomaly Alert</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Flagged discrepancies and unusual values.
                    </Text>
                  </Card>
                </Col>
              </Row>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                3. Specific Question or Concern (Optional)
              </Text>
              <Input
                placeholder="e.g. Why did attendance drop last month? Which categories lead performance?"
                value={beginnerQuestion}
                onChange={(e) => setBeginnerQuestion(e.target.value)}
              />
            </div>
          </Space>
        )}

        {/* ── PRO STRATEGY VIEW ─────────────────────────────────── */}
        {activeTier === 'pro' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              message="Pro Strategy Mode: Operational & Executive Intelligence"
              description="Target KPI attribution, stakeholder framing, and modular deliverable sections."
              type="info"
              showIcon
              style={isDark ? { background: '#172554', borderColor: '#1d4ed8', color: '#dbeafe' } : { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}
            />

            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Domain Context
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={proDomain}
                  onChange={setProDomain}
                >
                  {DOMAIN_OPTIONS.map((d) => (
                    <Option key={d.value} value={d.value}>
                      {d.label}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Target Metric / Key Column
                </Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select metric column"
                  value={proTargetKpi}
                  onChange={setProTargetKpi}
                >
                  {numericColumns.map((c) => (
                    <Option key={c} value={c}>
                      {c} (Numeric)
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Objective Direction
                </Text>
                <Radio.Group
                  value={proGoalDirection}
                  onChange={(e) => setProGoalDirection(e.target.value)}
                >
                  <Radio.Button value="maximize">Maximize</Radio.Button>
                  <Radio.Button value="minimize">Minimize</Radio.Button>
                  <Radio.Button value="detect_issues">Audit Only</Radio.Button>
                </Radio.Group>
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Target Audience
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={proAudience}
                  onChange={setProAudience}
                >
                  <Option value="executive">Executive & Board (Strategic)</Option>
                  <Option value="management">Department Management (Operational)</Option>
                  <Option value="trustee">Trustees & Stakeholders (Clear Review)</Option>
                </Select>
              </Col>
            </Row>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Deliverables & Sections:
              </Text>
              <Checkbox.Group
                value={proSections}
                onChange={(checked) => setProSections(checked as string[])}
              >
                <Row gutter={[16, 8]}>
                  <Col span={8}>
                    <Checkbox value="summary">Executive Summary</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="anomalies">Anomalies & Outliers</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="segments">Data & Group Segments</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="root_causes">Multi-Level Root Causes</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="forecast">30-Day Trajectory</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="actions">Prioritized Next Steps</Checkbox>
                  </Col>
                </Row>
              </Checkbox.Group>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Operational Notes / Context:
              </Text>
              <Input.TextArea
                rows={2}
                placeholder="e.g. Renovation completed in Q1; staffing reduced by 10%; major seasonal spike in November."
                value={proNotes}
                onChange={(e) => setProNotes(e.target.value)}
              />
            </div>
          </Space>
        )}

        {/* ── ULTRA PRO QUANT VIEW (Slate / Indigo, Zero Danger Red) ──── */}
        {activeTier === 'ultra_pro' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              message="Ultra Pro Mode: Statistical & Quant Parametrization"
              description="Directly parameterize isolation forests, correlation matrices, clustering geometries, and LaTeX proofs."
              type="info"
              showIcon
              style={isDark ? { background: '#1e1b4b', borderColor: '#4338ca', color: '#e0e7ff' } : { background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
            />

            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Target Dependent Variable
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={ultraTargetKpi}
                  onChange={setUltraTargetKpi}
                >
                  {numericColumns.map((c) => (
                    <Option key={c} value={c}>{c}</Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Anomaly Detection Model
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={ultraAnomalyAlgo}
                  onChange={setUltraAnomalyAlgo}
                >
                  <Option value="isolation_forest">Isolation Forest (Tree Partitioning)</Option>
                  <Option value="lof">Local Outlier Factor (Density Estimation)</Option>
                  <Option value="zscore">Robust Median Absolute Deviation (MAD)</Option>
                </Select>
              </Col>
            </Row>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Contamination Parameter (ν): {(ultraContamination * 100).toFixed(1)}%
              </Text>
              <Slider
                min={0.005}
                max={0.15}
                step={0.005}
                value={ultraContamination}
                onChange={setUltraContamination}
                marks={{
                  0.01: '1% (Strict)',
                  0.05: '5% (Balanced)',
                  0.10: '10% (Permissive)',
                }}
              />
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Correlation Method
                </Text>
                <Radio.Group
                  value={ultraCorrMethod}
                  onChange={(e) => setUltraCorrMethod(e.target.value)}
                >
                  <Radio.Button value="spearman">Spearman Rank</Radio.Button>
                  <Radio.Button value="pearson">Pearson Linear</Radio.Button>
                </Radio.Group>
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Significance Threshold: |r| ≥ {ultraCorrThreshold}
                </Text>
                <Slider
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  value={ultraCorrThreshold}
                  onChange={setUltraCorrThreshold}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Cluster Optimization
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={ultraClusterK}
                  onChange={setUltraClusterK}
                >
                  <Option value="auto">Auto-Silhouette Optimization</Option>
                  <Option value="3">Fixed k = 3</Option>
                  <Option value="5">Fixed k = 5</Option>
                  <Option value="8">Fixed k = 8</Option>
                </Select>
              </Col>
              <Col span={12}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Forecast Confidence Interval
                </Text>
                <Radio.Group
                  value={ultraConfidence}
                  onChange={(e) => setUltraConfidence(e.target.value)}
                >
                  <Radio.Button value={0.90}>90%</Radio.Button>
                  <Radio.Button value={0.95}>95%</Radio.Button>
                  <Radio.Button value={0.99}>99%</Radio.Button>
                </Radio.Group>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0', borderColor: isDark ? '#334155' : '#e2e8f0' }} />

            <Row align="middle" justify="space-between">
              <Col>
                <Text strong>Mathematical Formulations (LaTeX)</Text>
                <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                  Includes explicit equations for covariance, loss boundaries, and centroid Euclidean distance.
                </Paragraph>
              </Col>
              <Col>
                <Switch
                  checked={ultraLatexFormulas}
                  onChange={setUltraLatexFormulas}
                />
              </Col>
            </Row>
          </Space>
        )}
      </Modal>

      {/* Save Template Modal */}
      <Modal
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        title="Save Analysis Template"
        onOk={handleSaveTemplate}
        confirmLoading={savingTemplate}
        okText="Save Template"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text type="secondary">
            Save this configuration to your local template library for 1-click re-use across new datasets.
          </Text>
          <div>
            <Text strong>Template Name *</Text>
            <Input
              placeholder="e.g. Quarterly Audit, Annual Trustee Review, Quant LOF Model"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          </div>
          <div>
            <Text strong>Description (Optional)</Text>
            <Input.TextArea
              rows={2}
              placeholder="Summary of parameters and when to use this configuration..."
              value={newTemplateDesc}
              onChange={(e) => setNewTemplateDesc(e.target.value)}
            />
          </div>
          <Space wrap>
            <Tag style={{ background: isDark ? '#1e293b' : '#f8fafc', color: isDark ? '#94a3b8' : '#475569', borderColor: isDark ? '#334155' : '#cbd5e1' }}>
              Mode: {activeTier.toUpperCase()}
            </Tag>
            {datasetFormat && (
              <Tag style={{ background: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#93c5fd' : '#334155', borderColor: isDark ? '#334155' : '#cbd5e1' }}>
                Format Bound: {datasetFormat.toUpperCase()}
              </Tag>
            )}
          </Space>
          <div style={{ background: isDark ? '#1e293b' : '#f8fafc', padding: '10px 12px', borderRadius: 6, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Template Compatibility Profile:
            </Text>
            <Space direction="vertical" size={2}>
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                File Format: <strong>{datasetFormat ? datasetFormat.toUpperCase() : 'ANY'}</strong>
              </Text>
              {(activeTier === 'pro' ? proTargetKpi : activeTier === 'ultra_pro' ? ultraTargetKpi : null) && (
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  Target Metric: <strong>{activeTier === 'pro' ? proTargetKpi : ultraTargetKpi}</strong>
                </Text>
              )}
              {datasetName && (
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  Origin Dataset: <strong>{datasetName}</strong>
                </Text>
              )}
            </Space>
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default TemplateStudioModal;
