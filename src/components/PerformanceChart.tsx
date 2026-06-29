import React from 'react';

interface ChartData {
  label: string;
  value: number;
}

interface PerformanceChartProps {
  data: ChartData[];
  title?: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="font-medium text-sm">No performance history yet</p>
        <p className="text-xs text-gray-400 mt-1">Complete your first quiz to see stats</p>
      </div>
    );
  }

  // If there's only 1 data point, double it to draw a flat line
  const chartData = data.length === 1 
    ? [{ label: '', value: data[0].value }, ...data] 
    : data;

  const width = 500;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = 100; // Quiz scores are percentages

  // Calculate coordinates
  const points = chartData.map((d, index) => {
    const x = paddingLeft + (index / (chartData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.value / maxVal) * chartHeight;
    return { x, y, value: d.value, label: d.label };
  });

  // Construct SVG Path string
  const linePath = points.reduce((path, p, index) => {
    return path + `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y} `;
  }, '');

  // Construct Fill Path string (area under the line)
  const fillPath = linePath 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <div>
      {title && <h4 className="text-gray-700 font-bold text-sm mb-4">{title}</h4>}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((gridVal) => {
            const y = paddingTop + chartHeight - (gridVal / maxVal) * chartHeight;
            return (
              <g key={gridVal} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#6b7280"
                  fontSize="10"
                  textAnchor="end"
                  className="font-medium"
                >
                  {gridVal}%
                </text>
              </g>
            );
          })}

          {/* Fill Area */}
          {fillPath && (
            <path
              d={fillPath}
              fill="url(#chartGlow)"
              className="transition-all duration-1000 ease-out"
            />
          )}

          {/* Line Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-1000 ease-out"
            />
          )}

          {/* Circles for points */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all duration-300 group-hover:r-6"
              />
              {/* Tooltip on hover */}
              <text
                x={p.x}
                y={p.y - 10}
                fill="#1f2937"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              >
                {p.value}%
              </text>
            </g>
          ))}

          {/* X Axis Labels */}
          {points.map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={height - 8}
              fill="#6b7280"
              fontSize="10"
              textAnchor="middle"
              className="opacity-80"
            >
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

export default PerformanceChart;
