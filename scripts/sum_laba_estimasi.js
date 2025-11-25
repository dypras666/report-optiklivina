async function main(){
  const pembukuanId = process.argv[2] || '124'
  const cabangId = process.argv[3] || '1'
  const url = `http://localhost:4000/api/reports/laba-rugi/details?pembukuan_id=${encodeURIComponent(pembukuanId)}&cabang=${encodeURIComponent(cabangId)}`
  const res = await fetch(url)
  const json = await res.json()
  const arr = Array.isArray(json.data) ? json.data : []
  const sum = arr.reduce((a,r)=>a + Number(r.laba_estimasi||0), 0)
  console.log(JSON.stringify({ pembukuanId, cabangId, count: arr.length, sum_laba_estimasi: Math.round(sum) }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })