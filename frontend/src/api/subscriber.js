import api from "./axios";

export const subscriberAPI = {
  register: (data) => {
    return api
      .post("/subscribers", data)
      .then((res) => res.data)
      .catch((err) =>
        console.error(
          `[API ERROR] ${err.config?.method?.toUpperCase()} ${err.config?.url}`,
          `→ status: ${err.response?.status ?? "no response"}`,
          `→ message: ${err.response?.data?.detail ?? err.message}`
        )
      );
  },

  getAll: (params) => {
    return api
      .get("/subscribers", { params })
      .then((res) => res.data)
      .catch((err) =>
        console.error(
          `[API ERROR] ${err.config?.method?.toUpperCase()} ${err.config?.url}`,
          `→ status: ${err.response?.status ?? "no response"}`,
          `→ message: ${err.response?.data?.detail ?? err.message}`
        )
      );
  },

  getById: (id) => {
    return api
      .get(`/subscribers/${id}`)
      .then((res) => res.data)
      .catch((err) =>
        console.error(
          `[API ERROR] ${err.config?.method?.toUpperCase()} ${err.config?.url}`,
          `→ status: ${err.response?.status ?? "no response"}`,
          `→ message: ${err.response?.data?.detail ?? err.message}`
        )
      );
  },
};
