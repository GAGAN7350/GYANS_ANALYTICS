import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Row, Col, Typography, Empty, Spin, Space, Badge } from 'antd';
import {
  LineChartOutlined,
  ClusterOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { DatasetPatternsData } from '@/services/datasetService';
import { useUiStore } from '@/stores/uiStore';

const { Title } = Typography;

interface ReportVisualsProps {
  patterns: DatasetPatternsData | null;
  loading?: boolean;
}

const GYAN_CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

export const ReportVisuals: React.FC<ReportVisualsProps> = ({ patterns, loading = false }) => {
  const isDark = useUiStore((state) => state.theme === 'dark');

  if (loading) {
    return (
      <Card
        size="small"
        style={{
          marginTop: 20,
          background: isDark ? '#141414' : '#ffffff',
          borderColor: isDark ? '#262626' : '#e2e8f0',
          textAlign: 'center',
          padding: '40px 0',
        }}
      >
        <Spin tip="Synthesizing ML visual intelligence..." />
      </Card>
    );
  }

  if (!patterns || !patterns.patterns) {
    return null;
  }

  const { anomalies, clusters, correlations } = patterns.patterns;
  const textColor = isDark ? '#cbd5e1' : '#334155';
  const headingColor = isDark ? '#f8fafc' : '#0f172a';
  const gridLineColor = isDark ? '#334155' : '#e2e8f0';

  // 1. Correlation Drivers Option
  let correlationOption: any = null;
  if (correlations?.has_correlations && correlations.top_drivers?.length) {
    const drivers = correlations.top_drivers.slice(0, 7);
    const labels = drivers.map((d) => `${d.feature_a} vs ${d.feature_b}`);
    const values = drivers.map((d) => Number(d.correlation.toFixed(3)));

    correlationOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          const driver = drivers[item.dataIndex];
          return `<b>${driver.feature_a}</b> & <b>${driver.feature_b}</b><br/>` +
                 `Correlation (r): <b>${driver.correlation.toFixed(3)}</b><br/>` +
                 `Relationship: <b>${driver.relationship} (${driver.strength})</b>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: {
        type: 'value',
        min: -1,
        max: 1,
        splitLine: { lineStyle: { color: gridLineColor } },
        axisLabel: { color: textColor },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: textColor,
          formatter: (value: string) => (value.length > 22 ? `${value.slice(0, 20)}...` : value),
        },
      },
      series: [
        {
          name: 'Correlation (r)',
          type: 'bar',
          data: values.map((val) => ({
            value: val,
            itemStyle: {
              color: val >= 0 ? '#10b981' : '#ef4444',
              borderRadius: [0, 4, 4, 0],
            },
          })),
        },
      ],
    };
  }

  // 2. Cohort Clusters Option
  let clusterOption: any = null;
  if (clusters?.clustered && clusters.clusters?.length) {
    const clusterData = clusters.clusters.map((c, idx) => ({
      name: c.name,
      value: c.size,
      percentage: c.percentage,
      itemStyle: { color: GYAN_CHART_COLORS[idx % GYAN_CHART_COLORS.length] },
    }));

    clusterOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data;
          return `<b>${params.name}</b><br/>` +
                 `Cohort Size: <b>${d.value.toLocaleString()} rows</b><br/>` +
                 `Share of Dataset: <b>${d.percentage.toFixed(1)}%</b>`;
        },
      },
      legend: {
        bottom: '0%',
        left: 'center',
        textStyle: { color: textColor },
      },
      series: [
        {
          name: 'Cohort Clusters',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark ? '#141414' : '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: headingColor,
            },
          },
          data: clusterData,
        },
      ],
    };
  }

  // 3. Anomaly Scores Option
  let anomalyOption: any = null;
  if (anomalies?.detected && anomalies.anomalous_samples?.length) {
    const samples = anomalies.anomalous_samples.slice(0, 15);
    const xLabels = samples.map((s) => `Row ${s.row_index}`);
    const scores = samples.map((s) => Number(s.anomaly_score.toFixed(3)));

    anomalyOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = params[0];
          const sample = samples[item.dataIndex];
          return `<b>Outlier ${xLabels[item.dataIndex]}</b><br/>` +
                 `Isolation Score: <b>${sample.anomaly_score.toFixed(3)}</b><br/>` +
                 `Anomaly Level: <b>Critical Outlier</b>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { color: textColor, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        min: 0.4,
        max: 1.0,
        splitLine: { lineStyle: { color: gridLineColor } },
        axisLabel: { color: textColor },
      },
      series: [
        {
          name: 'Anomaly Score',
          type: 'line',
          smooth: true,
          data: scores,
          markLine: {
            data: [{ yAxis: 0.6, name: 'Outlier Threshold (0.6)' }],
            lineStyle: { color: '#f59e0b', type: 'dashed' },
          },
          itemStyle: { color: '#ef4444' },
          areaStyle: {
            color: 'rgba(239, 68, 68, 0.15)',
          },
        },
      ],
    };
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ThunderboltOutlined style={{ color: isDark ? '#60a5fa' : '#2563eb', fontSize: 18 }} />
        <Title level={4} style={{ margin: 0, color: headingColor }}>
          Interactive Machine Learning Diagnostics
        </Title>
      </div>

      <Row gutter={[16, 16]}>
        {/* Correlation Heatmap / Driver Bars */}
        <Col xs={24} lg={12}>
          <Card
            size="small"
            style={{
              height: '100%',
              background: isDark ? '#141414' : '#ffffff',
              borderColor: isDark ? '#262626' : '#e2e8f0',
              borderRadius: 8,
            }}
            title={
              <Space>
                <LineChartOutlined style={{ color: '#10b981' }} />
                <span style={{ color: headingColor, fontWeight: 600 }}>Top Driver Correlations</span>
              </Space>
            }
          >
            {correlationOption ? (
              <ReactECharts
                option={correlationOption}
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No significant pairwise correlations identified."
              />
            )}
          </Card>
        </Col>

        {/* Cohort Clustering Donut */}
        <Col xs={24} lg={12}>
          <Card
            size="small"
            style={{
              height: '100%',
              background: isDark ? '#141414' : '#ffffff',
              borderColor: isDark ? '#262626' : '#e2e8f0',
              borderRadius: 8,
            }}
            title={
              <Space>
                <ClusterOutlined style={{ color: '#8b5cf6' }} />
                <span style={{ color: headingColor, fontWeight: 600 }}>Unsupervised Cohort Clusters</span>
              </Space>
            }
          >
            {clusterOption ? (
              <ReactECharts
                option={clusterOption}
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Dataset requires numeric features for unsupervised clustering."
              />
            )}
          </Card>
        </Col>

        {/* Anomaly Outlier Scatter / Line */}
        {anomalies?.detected && (
          <Col xs={24}>
            <Card
              size="small"
              style={{
                background: isDark ? '#141414' : '#ffffff',
                borderColor: isDark ? '#262626' : '#e2e8f0',
                borderRadius: 8,
              }}
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ef4444' }} />
                  <span style={{ color: headingColor, fontWeight: 600 }}>
                    Isolation Forest Outlier Severity ({anomalies.anomaly_count} Anomaly Rows / {anomalies.anomaly_percentage.toFixed(1)}%)
                  </span>
                </Space>
              }
            >
              {anomalyOption ? (
                <ReactECharts
                  option={anomalyOption}
                  style={{ height: 240, width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <Badge status="success" text="No anomaly outliers identified." />
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ReportVisuals;
