function ResultCard({

  title,
  value,
  subtitle

}) {

  return (

    <div className="rounded-xl bg-white p-6 shadow">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <h3 className="mt-2 text-3xl font-bold text-blue-800">
        {value}
      </h3>

      {subtitle && (

        <p className="mt-2 text-sm text-gray-500">
          {subtitle}
        </p>

      )}

    </div>

  );
}

export default ResultCard;