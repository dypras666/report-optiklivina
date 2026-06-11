import axios from 'axios'
import { API_BASE } from '../config'

export async function fetchCabangList() {
    const res = await axios.get(`${API_BASE}/api/options/cabang`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
    return res.data.data || []
}

export async function fetchMarketingList() {
    const res = await axios.get(`${API_BASE}/api/options/marketing`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
    return res.data.data || []
}

export async function fetchPembukuanList() {
    const res = await axios.get(`${API_BASE}/api/pembukuan/list`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
    return res.data.data || []
}
