const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
};


export const fetcher = async (path: string, options?: RequestInit) => {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // Attach extra info to the error object.
    (error as any).info = await res.json();
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};
