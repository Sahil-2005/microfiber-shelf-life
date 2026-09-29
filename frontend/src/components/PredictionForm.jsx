import { useState } from 'react'

const initialForm = {
  Fabric_Type: 'Microfiber',
  Fabric_Weight_gsm: 300,
  Yarn_Count: 75,
  Weave_Type: 'Plain',
  Wash_Temperature_C: 40,
  Detergent_Type: 'Liquid',
  Mechanical_Agitation: 1,
  Number_of_Washes: 10,
}

function PredictionForm({ onPredict, disabled }) {
  const [formData, setFormData] = useState(initialForm)

  const updateField = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const submitForm = (event) => {
    event.preventDefault()
    onPredict(formData)
  }

  return (
    <section className="form-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / Fabric profile</p>
          <h2>Set the wash conditions</h2>
        </div>
        <p className="section-note">The model evaluates release in milligrams and estimates when the 20 mg threshold is reached.</p>
      </div>

      <form onSubmit={submitForm}>
        <div className="form-grid">
          <label>Fabric type<select name="Fabric_Type" value={formData.Fabric_Type} onChange={updateField}><option>Microfiber</option><option>Cotton</option><option>Polyester</option><option>Nylon</option></select></label>
          <label>Weave type<select name="Weave_Type" value={formData.Weave_Type} onChange={updateField}><option>Plain</option><option>Twill</option><option>Satin</option><option>Knitted</option></select></label>
          <label>Fabric weight <span>(gsm)</span><input name="Fabric_Weight_gsm" type="number" min="1" step="any" value={formData.Fabric_Weight_gsm} onChange={updateField} required /></label>
          <label>Yarn count <span>(Ne)</span><input name="Yarn_Count" type="number" min="1" step="any" value={formData.Yarn_Count} onChange={updateField} required /></label>
          <label>Wash temperature <span>(°C)</span><input name="Wash_Temperature_C" type="number" min="0" step="any" value={formData.Wash_Temperature_C} onChange={updateField} required /></label>
          <label>Detergent type<select name="Detergent_Type" value={formData.Detergent_Type} onChange={updateField}><option>Liquid</option><option>Powder</option><option>Pods</option><option>None</option></select></label>
          <label>Mechanical agitation <span>(0-1)</span><input name="Mechanical_Agitation" type="number" min="0" max="1" step="any" value={formData.Mechanical_Agitation} onChange={updateField} required /></label>
          <label>Current washes <span>(cycles)</span><input name="Number_of_Washes" type="number" min="0" step="1" value={formData.Number_of_Washes} onChange={updateField} required /></label>
        </div>
        <button className="primary-button" type="submit" disabled={disabled}>
          {disabled ? 'Calculating...' : 'Run prediction'}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </section>
  )
}

export default PredictionForm
