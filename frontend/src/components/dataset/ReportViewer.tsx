import React from 'react';
import { Typography, theme, Divider } from 'antd';
import { useUiStore } from '@/stores/uiStore';

const { Title, Text, Paragraph } = Typography;

interface ReportViewerProps {
  markdown: string;
  tier?: 'beginner' | 'pro' | 'ultra_pro';
}

function renderInlineText(text: string, isDark: boolean): React.ReactNode[] {
  // Regex to split on bold (**text**), inline math ($math$), and inline code (`code`)
  const regex = /(\*\*[^*]+\*\*|\$[^$]+\$|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} style={{ fontWeight: 600, color: isDark ? '#f8fafc' : '#0f172a' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          style={{
            background: isDark ? '#1e293b' : '#f1f5f9',
            color: isDark ? '#38bdf8' : '#0284c7',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'Consolas, Monaco, monospace',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return (
        <span
          key={idx}
          style={{
            fontFamily: 'KaTeX_Math, "Times New Roman", serif',
            fontStyle: 'italic',
            padding: '0 3px',
            color: isDark ? '#a5b4fc' : '#4f46e5',
            fontWeight: 500,
          }}
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

const ReportViewer: React.FC<ReportViewerProps> = ({ markdown }) => {
  const { token } = theme.useToken();
  const isDark = useUiStore((state) => state.theme === 'dark');

  if (!markdown) {
    return <Text type="secondary">No content available.</Text>;
  }

  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 1. Horizontal rule
    if (line === '---' || line === '***') {
      elements.push(<Divider key={`hr-${i}`} style={{ margin: '18px 0', borderColor: isDark ? '#334155' : '#e2e8f0' }} />);
      i++;
      continue;
    }

    // 2. Headings
    if (line.startsWith('# ')) {
      elements.push(
        <Title
          key={`h1-${i}`}
          level={2}
          style={{
            marginTop: 4,
            marginBottom: 12,
            color: isDark ? '#f8fafc' : '#0f172a',
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          {line.replace('# ', '')}
        </Title>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <Title
          key={`h2-${i}`}
          level={3}
          style={{
            marginTop: 20,
            marginBottom: 10,
            color: isDark ? '#f1f5f9' : '#1e293b',
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          {line.replace('## ', '')}
        </Title>
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <Title
          key={`h3-${i}`}
          level={4}
          style={{
            marginTop: 18,
            marginBottom: 8,
            color: isDark ? '#e2e8f0' : '#334155',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          {renderInlineText(line.replace('### ', ''), isDark)}
        </Title>
      );
      i++;
      continue;
    }

    // 3. Mathematical proof block ($$ ... $$)
    if (line.startsWith('$$')) {
      const mathContent = line.endsWith('$$') && line.length > 2
        ? line.slice(2, -2).trim()
        : line.slice(2).trim();
      elements.push(
        <div
          key={`math-${i}`}
          style={{
            margin: '12px 0',
            padding: '12px 18px',
            background: isDark ? '#0f172a' : '#f8fafc',
            border: `1px solid ${isDark ? '#312e81' : '#cbd5e1'}`,
            borderRadius: 6,
            textAlign: 'center',
            fontFamily: 'Consolas, "Cambria Math", serif',
            fontSize: 15,
            color: isDark ? '#818cf8' : '#3730a3',
            overflowX: 'auto',
          }}
        >
          {mathContent || '$$'}
        </div>
      );
      i++;
      continue;
    }

    // 4. Blockquotes (> ...)
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      elements.push(
        <div
          key={`quote-${i}`}
          style={{
            margin: '12px 0',
            padding: '10px 16px',
            borderLeft: `4px solid ${isDark ? '#3b82f6' : '#2563eb'}`,
            background: isDark ? '#1e293b' : '#f0f9ff',
            borderRadius: '0 6px 6px 0',
            fontSize: 13.5,
            color: isDark ? '#e2e8f0' : '#1e3a8a',
            fontStyle: 'italic',
          }}
        >
          {renderInlineText(quoteText, isDark)}
        </div>
      );
      i++;
      continue;
    }

    // 5. Tables (| col | col |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        // Skip separator row (| :--- | :--- |)
        const dataRows = tableLines.slice(2).map((rowStr) =>
          rowStr
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${i}`} style={{ margin: '14px 0', overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ background: isDark ? '#1e293b' : '#f8fafc' }}>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: isDark ? '#e2e8f0' : '#334155',
                        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      }}
                    >
                      {renderInlineText(h, isDark)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      background: rIdx % 2 === 0 ? 'transparent' : isDark ? '#141e30' : '#fcfcfd',
                      borderBottom: `1px solid ${isDark ? '#263347' : '#f1f5f9'}`,
                    }}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '8px 12px',
                          color: isDark ? '#cbd5e1' : '#475569',
                        }}
                      >
                        {renderInlineText(cell, isDark)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // 6. Ordered or unordered list items
    const isBullet = line.startsWith('- ') || line.startsWith('* ');
    const isNumber = /^\d+\.\s/.test(line);

    if (isBullet || isNumber) {
      const bulletContent = isBullet ? line.slice(2) : line.replace(/^\d+\.\s/, '');
      const prefix = isNumber ? line.match(/^\d+\./)?.[0] : '•';

      elements.push(
        <div
          key={`list-${i}`}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            margin: '6px 0',
            fontSize: 14,
            lineHeight: 1.7,
            color: isDark ? '#cbd5e1' : '#334155',
          }}
        >
          <span style={{ color: isDark ? '#60a5fa' : '#2563eb', fontWeight: 600, minWidth: 16 }}>
            {prefix}
          </span>
          <div style={{ flex: 1 }}>{renderInlineText(bulletContent, isDark)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Regular paragraph
    elements.push(
      <Paragraph
        key={`p-${i}`}
        style={{
          margin: '8px 0',
          fontSize: 14,
          lineHeight: 1.8,
          color: isDark ? '#cbd5e1' : '#334155',
        }}
      >
        {renderInlineText(line, isDark)}
      </Paragraph>
    );
    i++;
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        background: isDark ? '#141414' : '#ffffff',
        borderRadius: 8,
        border: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`,
        color: token.colorText,
      }}
    >
      {elements}
    </div>
  );
};

export default ReportViewer;
