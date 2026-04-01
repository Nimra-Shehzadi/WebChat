const COUNTRIES = [
  'Any','Afghanistan','Albania','Algeria','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Bolivia','Brazil','Canada','Chile','China','Colombia',
  'Czech Republic','Denmark','Ecuador','Egypt','Ethiopia','Finland','France',
  'Germany','Ghana','Greece','Guatemala','Hungary','India','Indonesia','Iran',
  'Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia',
  'Mexico','Morocco','Myanmar','Netherlands','New Zealand','Nigeria','Norway',
  'Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia',
  'Saudi Arabia','Senegal','South Africa','South Korea','Spain','Sri Lanka',
  'Sudan','Sweden','Switzerland','Syria','Taiwan','Tanzania','Thailand',
  'Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe',
];

export default function FilterMenu({ filter, onChange }) {
  function set(key, value) {
    onChange((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="filter-menu">
      <div className="filter-row">
        <label htmlFor="f-gender">Gender</label>
        <select
          id="f-gender"
          value={filter.gender}
          onChange={(e) => set('gender', e.target.value)}
        >
          <option value="Any">Any</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div className="filter-row">
        <label htmlFor="f-country">Country</label>
        <select
          id="f-country"
          value={filter.country}
          onChange={(e) => set('country', e.target.value)}
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <p className="filter-note">🌟 PRO filters – subscribers only</p>
    </div>
  );
}
