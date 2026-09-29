function ResultCard({ label, title, value, subtitle, accent }) {
  return (
    <article className={`result-card ${accent ? 'result-card-accent' : ''}`}>
      <p className="eyebrow">{label}</p>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{subtitle}</p>
    </article>
  )
}

export default ResultCard
