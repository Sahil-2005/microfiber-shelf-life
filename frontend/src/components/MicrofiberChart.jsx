import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function MicrofiberChart({ washValues, predictions, threshold }) {
  const chartData = washValues.map((wash, index) => ({ wash, release: predictions[index] }))

  return (
    <section className="chart-panel">
      <div className="section-heading chart-heading">
        <div>
          <p className="eyebrow">02 / Lifecycle curve</p>
          <h2>Release across 50 wash cycles</h2>
        </div>
        <span className="legend"><i /> Predicted release</span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#d9e1dc" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="wash" tickLine={false} axisLine={false} tick={{ fill: '#718078', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#718078', fontSize: 12 }} width={42} />
            <Tooltip formatter={(value) => [`${value} mg`, 'Release']} labelFormatter={(value) => `Wash ${value}`} />
            <ReferenceLine y={threshold} stroke="#d88754" strokeDasharray="6 5" label={{ value: `${threshold} mg limit`, fill: '#b76537', fontSize: 12, position: 'insideTopRight' }} />
            <Line type="monotone" dataKey="release" stroke="#157a6e" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: '#d88754', stroke: '#fff', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default MicrofiberChart
