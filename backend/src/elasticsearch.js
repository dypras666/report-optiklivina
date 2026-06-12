import { Client } from '@elastic/elasticsearch'
import dotenv from 'dotenv'
dotenv.config()

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  // auth: { username: process.env.ES_USER, password: process.env.ES_PASSWORD } // If auth is enabled later
})

export async function checkESConnection() {
  try {
    const health = await esClient.cluster.health({})
    console.log('[Elasticsearch] Cluster is', health.status)
    return true
  } catch (e) {
    console.error('[Elasticsearch] Connection Failed:', e.message)
    return false
  }
}

export { esClient }
