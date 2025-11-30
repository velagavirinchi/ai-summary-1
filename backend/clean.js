const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

async function clean() {
  console.log('🧹 Cleaning Redis queue...');
  // Deletes the 'celery' list where tasks are stored
  await redis.del('celery'); 
  console.log('✅ Queue cleared! Old bad tasks are gone.');
  process.exit(0);
}

clean();