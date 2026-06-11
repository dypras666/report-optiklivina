import axios from 'axios'
import { API_BASE } from '../config'

export async function fetchSponsorApprovals({ cabangId, marketingId, pembukuanId, page, pageSize, search, orderCol, orderDir }) {
    const params = {}
    if (cabangId) params.cabangId = cabangId
    if (marketingId) params.marketingId = marketingId
    if (pembukuanId) params.pembukuanId = pembukuanId
    if (page !== undefined) params.page = page
    if (pageSize !== undefined) params.pageSize = pageSize
    if (search) params.search = search
    if (orderCol) params.orderCol = orderCol
    if (orderDir) params.orderDir = orderDir

    const res = await axios.get(`${API_BASE}/api/sponsors/approvals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        params
    })
    return res.data
}

export async function updateSponsorApproval(kode_customer, action) {
    const res = await axios.post(`${API_BASE}/api/sponsors/approvals/${kode_customer}`, { action }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
    return res.data
}

export async function bulkUpdateSponsorApprovals(kodes, action) {
    const res = await axios.post(`${API_BASE}/api/sponsors/approvals/bulk`, { kodes, action }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
    return res.data
}
