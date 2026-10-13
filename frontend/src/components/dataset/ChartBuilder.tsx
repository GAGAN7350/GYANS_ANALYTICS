import React, { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Card,
  Select,
  Space,
  Typography,
  Spin,
  Alert,
  Row,
  Col,
  Tag,
  Button,
  Tooltip,
} from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  AreaChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { datasetService, ChartDataResponse } from '@/services/datasetService';

const { Text } = Typography;
const { Option } = Select;

interface ChartBuilderProps {
  datasetId: string;
  datasetName?: string;
}

const CHART_TYPES = [
  { value: 'bar',       label: 'Bar',       icon: <BarChartOutlined /> },
  { value: 'line',      label: 'Line',      icon: <LineChartOutlined /> },
  { value: 'pie',       label: 'Pie',       icon: <PieChartOutlined /> },
  { value: 'scatter',   label: 'Scatter',   icon: <DotChartOutlined /> },
  { value: 'histogram', label: 'Histogram', icon: <AreaChartOutlined /> },
];

const GYAN_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
];

function buildEChartsOption(data: ChartDataResponse): any {
  const { chartType, xCol, yCol, data: d } = data;

  switch (chartType) {
    case 'bar':
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: (d.x ?? []).map(String),
          axisLabel: { rotate: (d.x ?? []).length > 10 ? 30 : 0, overflow: 'truncate', width: 100 },
        },
        yAxis: { type: 'value', name: yCol ?? '' },
        series: [{
          name: yCol ?? 'Value',
          type: 'bar',
          data: d.y ?? [],
          itemStyle: { color: GYAN_COLORS[0] },
          emphasis: { itemStyle: { color: GYAN_COLORS[1] } },
        }],
      };

    case 'line':
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: (d.x ?? []).map(String),
          boundaryGap: false,
        },
        yAxis: { type: 'value', name: yCol ?? '' },
        series: [{
          name: yCol ?? 'Value',
          type: 'line',
          data: d.y ?? [],
          smooth: true,
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: GYAN_COLORS[0] },
        }],
      };

    case 'pie':
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{
          name: xCol ?? 'Category',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          data: (d.labels ?? []).map((label, i) => ({
            name: label,
            value: d.values?.[i] ?? 0,
            itemStyle: { color: GYAN_COLORS[i % GYAN_COLORS.length] },
          })),
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' },
          },
        }],
      };

    case 'scatter': {
      const points = (d.points ?? []).map(p => [p.x, p.y]);
      return {
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => {
            const val = p.value;
            if (Array.isArray(val)) {
              return `<b>${xCol}:</b> ${val[0]}<br/><b>${yCol}:</b> ${val[1]}`;
            }
            return `<b>${xCol} vs ${yCol}</b>`;
          },
        },
        grid: { left: '5%', right: '5%', bottom: '8%', top: '10%', containLabel: true },
        xAxis: { type: 'value', name: xCol ?? 'X', scale: true },
        yAxis: { type: 'value', name: yCol ?? 'Y', scale: true },
        series: [{
          name: `${xCol} vs ${yCol}`,
          type: 'scatter',
          data: points,
          symbolSize: points.length > 300 ? 6 : 10,
          itemStyle: { color: GYAN_COLORS[2], opacity: 0.75 },
        }],
      };
    }

    case 'histogram':
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: (d.bins ?? []).map(b => b.toFixed(1)),
          name: xCol ?? 'Value',
        },
        yAxis: { type: 'value', name: 'Count' },
        series: [{
          name: 'Frequency',
          type: 'bar',
          data: d.counts ?? [],
          barWidth: '99%',
          itemStyle: { color: GYAN_COLORS[4] },
        }],
      };

    default:
      return {};
  }
}

const ChartBuilder: React.FC<ChartBuilderProps> = ({ datasetId }) => {
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedChart, setSelectedChart] = useState<string | undefined>(undefined);
  const [selectedX, setSelectedX] = useState<string | undefined>(undefined);
  const [selectedY, setSelectedY] = useState<string | undefined>(undefined);

  const fetchChartData = useCallback(async (opts?: { chartType?: string; xCol?: string; yCol?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const targetChart = opts?.chartType ?? selectedChart;
      const targetX     = opts?.xCol ?? selectedX;
      const targetY     = opts?.yCol ?? selectedY;

      const result = await datasetService.chartData(datasetId, {
        chartType: targetChart,
        xCol:      targetX,
        yCol:      targetY,
        limit:     500,
      });

      setChartData(result);
      setSelectedChart(result.chartType);
      setSelectedX(result.xCol ?? undefined);
      setSelectedY(result.yCol ?? undefined);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  }, [datasetId, selectedChart, selectedX, selectedY]);

  // Initial auto-load
  useEffect(() => {
    fetchChartData();
  }, [datasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChartTypeChange = (val: string) => {
    setSelectedChart(val);
    let newX = selectedX;
    let newY = selectedY;

    if (val === 'scatter' && chartData?.numericCols && chartData.numericCols.length > 0) {
      if (!newX || !chartData.numericCols.includes(newX)) {
        newX = chartData.numericCols[0];
        setSelectedX(newX);
      }
      if (!newY || !chartData.numericCols.includes(newY) || newY === newX) {
        newY = chartData.numericCols.length > 1 ? chartData.numericCols[1] : chartData.numericCols[0];
        setSelectedY(newY);
      }
    }

    fetchChartData({ chartType: val, xCol: newX, yCol: newY });
  };

  const handleXChange = (val: string) => {
    setSelectedX(val);
    fetchChartData({ xCol: val });
  };

  const handleYChange = (val: string) => {
    setSelectedY(val);
    fetchChartData({ yCol: val });
  };

  const echartsOption = chartData ? buildEChartsOption(chartData) : null;

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: '#1890ff' }} />
          <span>Chart Builder</span>
          {chartData && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              Auto: {chartData.chartType.toUpperCase()}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Tooltip title="Reload chart">
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => fetchChartData()}
            loading={loading}
          />
        </Tooltip>
      }
      style={{ marginBottom: 24 }}
    >
      {/* Controls */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Chart Type</Text>
          <Select
            style={{ width: '100%' }}
            value={selectedChart}
            onChange={handleChartTypeChange}
            placeholder="Auto-detect"
            loading={loading}
          >
            {CHART_TYPES.map(ct => (
              <Option key={ct.value} value={ct.value}>
                <Space>{ct.icon}{ct.label}</Space>
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={8}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>X Axis / Category</Text>
          <Select
            style={{ width: '100%' }}
            value={selectedX}
            onChange={handleXChange}
            placeholder="Auto-select"
            loading={loading}
            showSearch
          >
            {chartData?.allCols.map(col => (
              <Option key={col} value={col}>{col}</Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={8}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Y Axis / Value</Text>
          <Select
            style={{ width: '100%' }}
            value={selectedY}
            onChange={handleYChange}
            placeholder="Auto-select"
            loading={loading}
            showSearch
            disabled={selectedChart === 'pie' || selectedChart === 'histogram'}
          >
            {chartData?.numericCols.map(col => (
              <Option key={col} value={col}>{col}</Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* Column type tags */}
      {chartData && (
        <Space wrap style={{ marginBottom: 16 }}>
          {chartData.numericCols.length > 0 && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Numeric: </Text>
              {chartData.numericCols.map(c => <Tag key={c} color="blue" style={{ fontSize: 11 }}>{c}</Tag>)}
            </span>
          )}
          {chartData.categoricalCols.length > 0 && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Categorical: </Text>
              {chartData.categoricalCols.map(c => <Tag key={c} color="green" style={{ fontSize: 11 }}>{c}</Tag>)}
            </span>
          )}
          {chartData.datetimeCols.length > 0 && (
            <span>
              <Text type="secondary" style={{ fontSize: 11 }}>Date/Time: </Text>
              {chartData.datetimeCols.map(c => <Tag key={c} color="purple" style={{ fontSize: 11 }}>{c}</Tag>)}
            </span>
          )}
        </Space>
      )}

      {/* Chart */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Building chart..." />
        </div>
      )}

      {error && !loading && (
        <Alert
          type="error"
          message="Chart Error"
          description={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && !error && echartsOption && (
        <ReactECharts
          option={echartsOption}
          style={{ height: 380 }}
          notMerge
          lazyUpdate
        />
      )}
    </Card>
  );
};

export default ChartBuilder;
