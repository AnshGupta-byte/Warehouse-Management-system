const API_BASE_URL = 'http://localhost:5000/api';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('wms_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export const api = {
  auth: {
    login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/auth/me'),
    register: (userData: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  },
  products: {
    list: (params: { category?: string; search?: string } = {}) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/products?${query}`);
    },
    create: (data: any) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),
    adjustStock: (data: any) => request('/products/adjust-stock', { method: 'POST', body: JSON.stringify(data) }),
    categories: () => request('/products/categories'),
    createCategory: (data: any) => request('/products/categories', { method: 'POST', body: JSON.stringify(data) }),
  },
  warehouses: {
    list: () => request('/warehouses'),
    get: (id: string) => request(`/warehouses/${id}`),
    heatmap: (id: string) => request(`/warehouses/${id}/heatmap`),
    updateBin: (warehouseId: string, binKey: string, data: any) =>
      request(`/warehouses/${warehouseId}/bins/${encodeURIComponent(binKey)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  orders: {
    list: (params: { type?: string; status?: string } = {}) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/orders?${query}`);
    },
    create: (data: any) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string, warehouseId?: string) => 
      request(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, warehouseId }) }),
  },
  forecasting: {
    list: () => request('/forecasting'),
    trigger: () => request('/forecasting/trigger', { method: 'POST' }),
    reorderRecommendations: () => request('/forecasting/reorder-recommendations'),
  },
  alerts: {
    list: (params: { isResolved?: boolean } = {}) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/alerts?${query}`);
    },
    read: (id: string) => request(`/alerts/${id}/read`, { method: 'PUT' }),
    resolve: (id: string) => request(`/alerts/${id}/resolve`, { method: 'PUT' }),
  },
  chatbot: {
    query: (queryText: string) => request('/chatbot', { method: 'POST', body: JSON.stringify({ query: queryText }) }),
  },
  analytics: {
    abc: () => request('/analytics/abc'),
    trends: (params: { productIds?: string; months?: string } = {}) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/analytics/trends?${query}`);
    },
    turnover: () => request('/analytics/turnover'),
  },
  users: {
    list: () => request('/users'),
    get: (id: string) => request(`/users/${id}`),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  },
};
