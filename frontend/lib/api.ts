import axios, { InternalAxiosRequestConfig } from "axios";

// Auth backend — handles login, credential issuing/revocation
const api = axios.create({
  baseURL: "http://localhost:4000",
});

// Content backend — serves age-appropriate content
export const contentApi = axios.create({
  baseURL: "http://localhost:4001",
});

// Automatically attach the JWT token from localStorage to every request on both instances
const attachToken = (config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
};

api.interceptors.request.use(attachToken);
contentApi.interceptors.request.use(attachToken);

export default api;
