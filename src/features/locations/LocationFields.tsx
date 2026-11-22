import { useEffect, useState } from 'react';
import { readProvinceCities, readProvinces } from '../../api';
import { type City, type Placement, type Province, locationLabel } from './locations';

const legacy = 'legacy';

export default function LocationFields({ existing }: { existing?: Placement }) {
  const [provinces, setProvinces] = useState<Province[]>();
  const [cities, setCities] = useState<{ province: string; items: City[] }>();
  const [provinceChoice, setProvinceChoice] = useState<string>();
  const [cityChoice, setCityChoice] = useState<string>();
  const [citySearch, setCitySearch] = useState('');
  const [provinceError, setProvinceError] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [retry, setRetry] = useState(0);

  const initialProvince = provinces?.find(province => province.code === existing?.provinceCode)
    ?? provinces?.find(province => locationLabel(province.name) === locationLabel(existing?.province ?? ''));
  const provinceCode = provinceChoice ?? initialProvince?.code ?? (existing?.province ? legacy : '');
  const isProvinceCode = Boolean(provinceCode && provinceCode !== legacy);
  const provinceName = provinceCode === legacy ? existing?.province || ''
    : provinces?.find(province => province.code === provinceCode)?.name || '';
  const cityRows = cities?.province === provinceCode ? cities.items : undefined;
  const waiting = isProvinceCode && !cityRows;
  const sameProvince = provinceChoice === undefined || provinceCode === initialProvince?.code;
  const existingCityName = sameProvince ? existing?.city ?? '' : '';
  const matches = cityRows?.filter(city => locationLabel(city.name) === locationLabel(existingCityName)) ?? [];
  const initialCity = cityRows?.find(city => city.code === existing?.cityCode) ?? (matches.length === 1 ? matches[0] : undefined);
  const cityCode = cityChoice ?? initialCity?.code ?? (existingCityName ? legacy : '');
  const cityName = cityCode === legacy ? existingCityName : cityRows?.find(city => city.code === cityCode)?.name ?? '';
  const search = locationLabel(citySearch);
  const filteredCities = cityRows?.filter(city => city.code === cityCode || !search || locationLabel(city.name).includes(search)) ?? [];
  const cityNames = new Map<string, number>();
  for (const row of cityRows ?? []) cityNames.set(row.name, (cityNames.get(row.name) ?? 0) + 1);

  useEffect(() => {
    if (provinces) return;
    const controller = new AbortController();
    setProvinceError(false);
    readProvinces(controller.signal).then(data => {
      if (!controller.signal.aborted) setProvinces(data);
    }).catch(() => { if (!controller.signal.aborted) setProvinceError(true); });
    return () => controller.abort();
  }, [provinces, retry]);

  useEffect(() => {
    if (!isProvinceCode) return;
    const controller = new AbortController();
    setCityError(false);
    readProvinceCities(provinceCode, controller.signal).then(items => {
      if (!controller.signal.aborted) setCities({ province: provinceCode, items });
    }).catch(() => { if (!controller.signal.aborted) setCityError(true); });
    return () => controller.abort();
  }, [isProvinceCode, provinceCode, retry]);

  return (
    <fieldset className="editor-fields editor-wide location-fields">
      <legend>موقعیت</legend>
      <label>استان
        <select aria-label="استان" value={provinceCode} disabled={!provinces} onChange={event => {
          setProvinceChoice(event.target.value);
          setCityChoice('');
          setCitySearch('');
        }}>
          <option value="">بدون استان</option>
          {!!existing?.province && !initialProvince && <option value={legacy}>{existing.province} (ثبت قبلی)</option>}
          {provinces?.map(province => <option key={province.code} value={province.code}>{province.name}</option>)}
        </select>
      </label>
      <label>شهر
        <select aria-label="شهر" value={cityCode} disabled={!provinceCode || waiting} onChange={event => setCityChoice(event.target.value)}>
          <option value="">{waiting && !cityError ? 'در حال بارگذاری شهرها…' : 'بدون شهر'}</option>
          {existingCityName && !initialCity && <option value={legacy}>{existingCityName} (ثبت قبلی)</option>}
          {filteredCities.map(city => <option key={city.code} value={city.code}>
            {city.name}{(cityNames.get(city.name) ?? 0) > 1 ? ' · ' + city.code : ''}
          </option>)}
        </select>
      </label>
      {cityRows && cityRows.length > 0 && <label className="editor-wide">جستجوی شهر<input type="search" value={citySearch}
        onChange={event => setCitySearch(event.target.value)} placeholder="نام شهر را وارد کنید" /></label>}
      {(provinceError || (waiting && cityError)) && <p className="editor-wide editor-error" role="alert">
        دریافت استان یا شهر انجام نشد. <button type="button" onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button>
      </p>}
      {provinces && (!waiting || provinceChoice !== undefined) && (
        <>
          <input type="hidden" name="province" value={provinceName} />
          <input type="hidden" name="provinceCode" value={isProvinceCode ? provinceCode : ''} />
          <input type="hidden" name="city" value={cityName} />
          <input type="hidden" name="cityCode" value={cityCode !== legacy ? cityCode : ''} />
        </>
      )}
    </fieldset>
  );
}
