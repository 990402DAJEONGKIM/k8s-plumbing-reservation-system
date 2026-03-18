import { useState, useEffect } from 'react';
import { fetcher } from './api';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const getAnnouncements = async () => {
      try {
        const data = await fetcher('/api/admin/announcements');
        if (data.success) {
          setAnnouncements(data.list);
        }
      } catch (err) {
        console.error("Failed to load announcements:", err);
      }
    };
    getAnnouncements();
  }, []);

  return announcements;
};
