import { useAuth } from '../../hooks/useAuth';
import { useActiveLapak } from '../../hooks/useActiveLapak';

export default function LapakSwitcher() {
  const { profile } = useAuth();
  const { activeLapak, setActiveLapak, availableLapaks } = useActiveLapak();

  // Hanya tampil untuk owner
  if (profile?.role !== 'owner') {
    return null;
  }

  return (
    <select
      value={activeLapak?.id || ''}
      onChange={(e) => {
        const selected = availableLapaks.find((l) => l.id === e.target.value);
        if (selected) setActiveLapak(selected);
      }}
      className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium
                 text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500
                 appearance-none cursor-pointer pr-8 relative"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ea580c'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '16px',
      }}
    >
      {availableLapaks.map((lapak) => (
        <option key={lapak.id} value={lapak.id}>
          {lapak.nama}
        </option>
      ))}
    </select>
  );
}
