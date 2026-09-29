import { useState } from "react";

function PredictionForm({ onPredict }) {

  const [formData, setFormData] = useState({

    Fabric_Type: "Cotton",

    Fabric_Weight_gsm: 150,

    Yarn_Count: 60,

    Weave_Type: "Plain",

    Wash_Temperature_C: 40,

    Detergent_Type: "Standard",

    Mechanical_Agitation: 1.0,

    Number_of_Washes: 10

  });


  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData({

      ...formData,

      [name]: value

    });

  };


  const handleSubmit = (e) => {

    e.preventDefault();

    onPredict(formData);

  };


  return (

    <div className="rounded-xl bg-white p-6 shadow">

      <h2 className="mb-6 text-xl font-bold">
        Fabric & Washing Parameters
      </h2>


      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >


        <div>

          <label className="block mb-1">
            Fabric Type
          </label>

          <select
            name="Fabric_Type"
            value={formData.Fabric_Type}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          >

            <option>Cotton</option>
            <option>Polyester</option>
            <option>Cotton-Poly Blend</option>
            <option>Nylon</option>
            <option>Acrylic</option>

          </select>

        </div>


        <div>

          <label className="block mb-1">
            Fabric Weight (gsm)
          </label>

          <input
            type="number"
            name="Fabric_Weight_gsm"
            value={formData.Fabric_Weight_gsm}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          />

        </div>


        <div>

          <label className="block mb-1">
            Yarn Count
          </label>

          <input
            type="number"
            name="Yarn_Count"
            value={formData.Yarn_Count}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          />

        </div>


        <div>

          <label className="block mb-1">
            Weave Type
          </label>

          <select
            name="Weave_Type"
            value={formData.Weave_Type}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          >

            <option>Plain</option>
            <option>Twill</option>
            <option>Satin</option>

          </select>

        </div>


        <div>

          <label className="block mb-1">
            Wash Temperature
          </label>

          <select
            name="Wash_Temperature_C"
            value={formData.Wash_Temperature_C}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          >

            <option value="30">30°C</option>
            <option value="40">40°C</option>
            <option value="50">50°C</option>
            <option value="60">60°C</option>

          </select>

        </div>


        <div>

          <label className="block mb-1">
            Detergent Type
          </label>

          <select
            name="Detergent_Type"
            value={formData.Detergent_Type}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          >

            <option>Standard</option>
            <option>Enzyme</option>
            <option>Eco</option>

          </select>

        </div>


        <div>

          <label className="block mb-1">
            Mechanical Agitation
          </label>

          <input
            type="number"
            step="0.1"
            min="0.5"
            max="1.5"
            name="Mechanical_Agitation"
            value={formData.Mechanical_Agitation}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          />

        </div>


        <div>

          <label className="block mb-1">
            Number of Washes
          </label>

          <input
            type="number"
            min="1"
            max="50"
            name="Number_of_Washes"
            value={formData.Number_of_Washes}
            onChange={handleChange}
            className="w-full rounded-lg border p-3"
          />

        </div>


        <button
          type="submit"
          className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 md:col-span-2"
        >

          Predict Microfiber Release

        </button>

      </form>

    </div>

  );
}

export default PredictionForm;