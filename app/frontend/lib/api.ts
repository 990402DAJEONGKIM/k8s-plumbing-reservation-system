const getBaseUrl = () => {
    // Server-side (SSR, API Routes)에서 실행될 때, 내부 Docker 네트워크 주소를 사용
    if (typeof window === 'undefined' && process.env.INTERNAL_API_URL) {
        return process.env.INTERNAL_API_URL;
    }
    // Client-side (브라우저)에서 실행될 때, 또는 INTERNAL_API_URL이 없을 때
    // NEXT_PUBLIC_API_URL은 빌드 시점에 주입되거나, 런타임 환경변수로 설정됩니다.
    return process.env.NEXT_PUBLIC_API_URL || ""; // 상대 경로 사용을 위해 빈 문자열로 변경
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
