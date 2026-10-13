import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Tag,
  Space,
  Typography,
  Modal,
  Upload,
  Form,
  message,
  Drawer,
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Alert,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  InboxOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  ClusterOutlined,
  LineChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { datasetService, DatasetPreviewData, DatasetPatternsData } from '@/services/datasetService';
import { Dataset } from '@/types';

const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

const DatasetListPage: React.FC = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploadForm] = Form.useForm();

  // Preview / Patterns Drawer State
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<DatasetPreviewData | null>(null);
  const [patternsData, setPatternsData] = useState<DatasetPatternsData | null>(null);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const data = await datasetService.list();
      setDatasets(data);
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.detail || 'Failed to load datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUploadSubmit = async () => {
    const filesToUpload = fileList
      .map((item) => (item as any).originFileObj || item)
      .filter((f) => f && (f instanceof Blob || f instanceof File || (f as any).name));

    if (filesToUpload.length === 0) {
      message.warning('Please select a CSV, Excel, or JSON file to upload.');
      return;
    }

    try {
      setUploading(true);
      const values = await uploadForm.validateFields().catch(() => ({}));

      let lastUploadedId = '';
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileName = (file as File).name || `Dataset ${i + 1}`;
        const datasetName =
          filesToUpload.length === 1 && values.datasetName
            ? values.datasetName
            : fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        message.loading({
          content: `Uploading & parsing "${datasetName}" (${i + 1}/${filesToUpload.length})...`,
          key: 'upload',
          duration: 0,
        });

        const uploaded = await datasetService.upload(file as File, datasetName);
        lastUploadedId = uploaded.id;
      }

      message.success({
        content: `File format validated and uploaded successfully!`,
        key: 'upload',
      });
      setIsUploadOpen(false);
      setFileList([]);
      uploadForm.resetFields();

      // Step 2: Navigate immediately to detail page with template wizard unlocked
      if (lastUploadedId) {
        navigate(`/datasets/${lastUploadedId}?setup=true`);
      } else {
        await fetchDatasets();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      message.error({
        content: err.response?.data?.detail || err.message || 'Upload failed.',
        key: 'upload',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDrawer = async (dataset: Dataset) => {
    setActiveDataset(dataset);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const [prev, pat] = await Promise.all([
        datasetService.preview(dataset.id, 100),
        datasetService.patterns(dataset.id)
      ]);
      setPreviewData(prev);
      setPatternsData(pat);
    } catch (err: any) {
      console.error(err);
      message.error('Failed to load dataset details.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await datasetService.delete(id);
      message.success('Dataset deleted successfully.');
      fetchDatasets();
      if (activeDataset?.id === id) {
        setDrawerOpen(false);
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to delete dataset.');
    }
  };

  const filteredDatasets = datasets.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Dataset) => (
        <Space direction="vertical" size={2}>
          <Space>
            <FileExcelOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            <Text strong style={{ cursor: 'pointer' }} onClick={() => handleOpenDrawer(record)}>
              {text}
            </Text>
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Records',
      key: 'rowCount',
      render: (_: any, record: any) => {
        const count = record.rowCount ?? record.row_count ?? 0;
        return <Text>{Number(count).toLocaleString()} rows</Text>;
      },
    },
    {
      title: 'Data Health',
      key: 'health',
      render: (_: any, record: any) => {
        const cfg = record.connectionConfig || record.connection_config;
        const health = cfg?.health;
        if (!health) return <Tag>Unrated</Tag>;
        const score = health.health_score ?? 100;
        const color = score >= 85 ? 'success' : score >= 70 ? 'processing' : 'warning';
        return (
          <Tag color={color}>
            {score}/100 • {health.rating || 'Good'}
          </Tag>
        );
      },
    },
    {
      title: 'ML Patterns',
      key: 'patterns',
      render: (_: any, record: any) => {
        const cfg = record.connectionConfig || record.connection_config;
        const patterns = cfg?.ml_patterns;
        if (!patterns) return <Tag>None</Tag>;
        const anomalyCount = patterns.anomalies?.anomaly_count ?? 0;
        const clusterCount = patterns.clusters?.k ?? 0;
        return (
          <Space>
            <Tag color={anomalyCount > 0 ? 'volcano' : 'default'} icon={<ThunderboltOutlined />}>
              {anomalyCount} Anomalies
            </Tag>
            <Tag color="cyan" icon={<ClusterOutlined />}>
              {clusterCount} Segments
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={status === 'ready' ? 'success' : 'processing'} text={status.toUpperCase()} />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Dataset) => (
        <Space size="middle">
          <Button
            type="primary"
            size="small"
            icon={<BarChartOutlined />}
            style={{ background: '#0f172a', borderColor: '#0f172a' }}
            onClick={() => navigate(`/datasets/${record.id}`)}
          >
            Analyze & Charts
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDrawer(record)}
          >
            Quick Preview
          </Button>
          <Popconfirm
            title="Delete Dataset"
            description="Are you sure you want to delete this dataset?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Dynamic preview table columns
  const previewTableCols =
    previewData?.columns.map((c) => ({
      title: (
        <div>
          <div>{c.name}</div>
          <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 'normal' }}>{c.type}</div>
        </div>
      ),
      dataIndex: c.name,
      key: c.name,
      render: (val: any) => {
        if (val === null || val === undefined) return <Text type="secondary" italic>null</Text>;
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        return String(val);
      },
    })) || [];

  return (
    <div>
      <PageHeader
        title="Datasets & Connectors"
        subtitle="Upload data files, inspect automated schema profiling, and explore ML pattern insights."
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsUploadOpen(true)}>
            Upload Dataset
          </Button>
        }
      />

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="Search datasets by name..."
          prefix={<SearchOutlined />}
          style={{ width: 320 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {filteredDatasets.length === 0 && !loading ? (
        <EmptyState
          icon={<DatabaseOutlined />}
          title="No Datasets Uploaded"
          description="Upload a CSV, Excel (.xlsx), or JSON file to run schema profiling and ML pattern recognition."
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsUploadOpen(true)}>
              Upload First Dataset
            </Button>
          }
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredDatasets}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      )}

      {/* UPLOAD MODAL */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined style={{ color: '#1890ff' }} />
            <span>Upload New Dataset (Free & Local)</span>
          </Space>
        }
        open={isUploadOpen}
        onCancel={() => setIsUploadOpen(false)}
        onOk={handleUploadSubmit}
        confirmLoading={uploading}
        okText="Upload & Analyze"
      >
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Dataset Name (Optional)" name="datasetName">
            <Input placeholder="e.g. Sales Q3 Report" />
          </Form.Item>

          <Form.Item label="Select Data File(s)" required>
            <Dragger
              fileList={fileList}
              multiple={true}
              beforeUpload={(_file) => false}
              onChange={(info) => {
                setFileList(info.fileList);
              }}
              onRemove={(file) => {
                setFileList((prev) => prev.filter((item) => (item.uid ? item.uid !== file.uid : item !== file)));
              }}
              accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.json,.jsonl,.ndjson,.parquet,.orc,.feather,.xml,.html,.sql,.sas7bdat,.dta,.sav"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#1890ff', fontSize: 40 }} />
              </p>
              <p className="ant-upload-text">Click or drag one or more data files here</p>
              <p className="ant-upload-hint">
                Supports: CSV, TSV, Excel (.xlsx/.xls), JSON, JSONL, Parquet, ORC, Feather, XML, HTML tables, SQL dumps, SAS, Stata, SPSS
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* EXPLORE & ML PATTERNS DRAWER */}
      <Drawer
        title={
          <Space>
            <DatabaseOutlined style={{ color: '#1890ff' }} />
            <Text strong>{activeDataset?.name || 'Dataset Details'}</Text>
          </Space>
        }
        width={950}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Tabs
          defaultActiveKey="preview"
          items={[
            {
              key: 'preview',
              label: (
                <span>
                  <EyeOutlined /> Data Preview (100 Rows)
                </span>
              ),
              children: (
                <div>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    First 100 rows loaded from local disk storage. Total dataset size: {previewData?.total_rows?.toLocaleString() || 0} rows.
                  </Paragraph>
                  <Table
                    columns={previewTableCols}
                    dataSource={previewData?.rows || []}
                    rowKey={(_rec, idx) => String(idx)}
                    loading={drawerLoading}
                    scroll={{ x: 'max-content', y: 460 }}
                    size="small"
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              ),
            },
            {
              key: 'patterns',
              label: (
                <span>
                  <ThunderboltOutlined /> ML Pattern Insights
                </span>
              ),
              children: (
                <div>
                  {/* Health Score Overview */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col span={8}>
                      <Card size="small" bordered>
                        <Statistic
                          title="Data Quality & Health"
                          value={patternsData?.data_health?.health_score || 0}
                          suffix="/ 100"
                          valueStyle={{
                            color:
                              (patternsData?.data_health?.health_score || 0) >= 80 ? '#3f8600' : '#cf1322',
                          }}
                        />
                        <Tag color="blue" style={{ marginTop: 8 }}>
                          Rating: {patternsData?.data_health?.rating || 'N/A'}
                        </Tag>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" bordered>
                        <Statistic
                          title="Isolation Forest Anomalies"
                          value={patternsData?.patterns?.anomalies?.anomaly_count || 0}
                          valueStyle={{ color: '#fa8c16' }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {patternsData?.patterns?.anomalies?.anomaly_percentage || 0}% of rows flagged
                        </Text>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" bordered>
                        <Statistic
                          title="K-Means Clusters"
                          value={patternsData?.patterns?.clusters?.k || 0}
                          valueStyle={{ color: '#13c2c2' }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Discovered behavioral groups
                        </Text>
                      </Card>
                    </Col>
                  </Row>

                  {/* Diagnostic Notes */}
                  {patternsData?.data_health?.diagnostic_notes && patternsData.data_health.diagnostic_notes.length > 0 && (
                    <Alert
                      message="Data Quality Diagnostics"
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {patternsData.data_health.diagnostic_notes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 20 }}
                    />
                  )}

                  {/* Anomaly Samples */}
                  <Title level={5}>
                    <ThunderboltOutlined style={{ color: '#fa8c16' }} /> Top Anomalous Rows Flagged by ML
                  </Title>
                  {patternsData?.patterns?.anomalies?.anomalous_samples && patternsData.patterns.anomalies.anomalous_samples.length > 0 ? (
                    <div style={{ marginBottom: 24 }}>
                      <Table
                        size="small"
                        dataSource={patternsData.patterns.anomalies.anomalous_samples.map((s) => ({
                          key: s.row_index,
                          rowIndex: s.row_index,
                          score: s.anomaly_score,
                          ...s.row_data,
                        }))}
                        columns={[
                          { title: 'Row #', dataIndex: 'rowIndex', key: 'rowIndex', width: 80 },
                          {
                            title: 'Anomaly Score',
                            dataIndex: 'score',
                            key: 'score',
                            width: 120,
                            render: (s: number) => <Tag color="volcano">{s}</Tag>,
                          },
                          ...Object.keys(patternsData.patterns.anomalies.anomalous_samples[0]?.row_data || {})
                            .slice(0, 5)
                            .map((k) => ({
                              title: k,
                              dataIndex: k,
                              key: k,
                              render: (val: any) => String(val ?? ''),
                            })),
                        ]}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 5 }}
                      />
                    </div>
                  ) : (
                    <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                      No significant anomalies detected in numerical columns.
                    </Paragraph>
                  )}

                  {/* K-Means Clusters */}
                  <Title level={5}>
                    <ClusterOutlined style={{ color: '#13c2c2' }} /> Discovered Clusters / Segments
                  </Title>
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {patternsData?.patterns?.clusters?.clusters?.map((c) => (
                      <Col span={12} key={c.cluster_id}>
                        <Card size="small" title={<Text strong>{c.name} ({c.size} rows • {c.percentage}%)</Text>}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            Cluster Centroid Feature Averages:
                          </Text>
                          {Object.entries(c.feature_averages || {}).map(([feat, avg]) => (
                            <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <Text code>{feat}:</Text>
                              <Text strong>{Number(avg).toLocaleString()}</Text>
                            </div>
                          ))}
                        </Card>
                      </Col>
                    ))}
                  </Row>

                  {/* Correlations */}
                  <Title level={5}>
                    <LineChartOutlined style={{ color: '#1890ff' }} /> Top Feature Correlations
                  </Title>
                  <Table
                    size="small"
                    dataSource={patternsData?.patterns?.correlations?.top_drivers?.map((d, i) => ({ key: i, ...d })) || []}
                    columns={[
                      { title: 'Feature A', dataIndex: 'feature_a', key: 'feature_a' },
                      { title: 'Feature B', dataIndex: 'feature_b', key: 'feature_b' },
                      {
                        title: 'Correlation (r)',
                        dataIndex: 'correlation',
                        key: 'correlation',
                        render: (r: number) => (
                          <Tag color={Math.abs(r) >= 0.7 ? 'green' : Math.abs(r) >= 0.4 ? 'blue' : 'default'}>
                            {r > 0 ? `+${r}` : r}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Relationship',
                        dataIndex: 'relationship',
                        key: 'relationship',
                        render: (rel: string) => <Tag>{rel.toUpperCase()}</Tag>,
                      },
                    ]}
                    pagination={false}
                  />
                </div>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default DatasetListPage;
