const { MongoClient } = require('mongodb');

(async () => {
  const uri = 'mongodb+srv://thomasedison6017_db_user:TCmuaY6ldtYNcQbt@cluster0.pwyvvxx.mongodb.net/intern_login_demo?appName=Cluster0';

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('STEP 1: Connected to Atlas');

    const ping = await client.db('admin').command({ ping: 1 });
    console.log('STEP 2: Ping response:', ping);

    const insert = await client.db('intern_login_demo').collection('test_connection').insertOne({
      ts: new Date(),
      msg: 'hello from harson'
    });
    console.log('STEP 3: Write test OK, inserted ID:', insert.insertedId);

    await client.close();
    console.log('STEP 4: Closed cleanly. ALL GOOD!');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();