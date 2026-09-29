import {

  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine

} from "recharts";


function MicrofiberChart({

  washValues,
  predictions,
  threshold

}) {

  if (!washValues || !predictions) {
    return null;
  }


  const chartData = washValues.map(
    (wash, index) => ({

      wash,

      microfiberRelease:
        predictions[index]

    })
  );


  return (

    <div className="mt-6 rounded-xl bg-white p-6 shadow">

      <h2 className="mb-6 text-xl font-bold">

        Microfiber Release vs Number of Washes

      </h2>


      <div className="h-96">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <LineChart data={chartData}>

            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="wash"
              label={{
                value: "Number of Washes",
                position: "insideBottom",
                offset: -5
              }}
            />

            <YAxis
              label={{
                value: "Microfiber Release (mg)",
                angle: -90,
                position: "insideLeft"
              }}
            />

            <Tooltip />

            <ReferenceLine
              y={threshold}
              stroke="red"
              strokeDasharray="5 5"
              label="Threshold"
            />

            <Line
              type="monotone"
              dataKey="microfiberRelease"
              stroke="#1d4ed8"
              strokeWidth={3}
              dot={false}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>

  );
}

export default MicrofiberChart;