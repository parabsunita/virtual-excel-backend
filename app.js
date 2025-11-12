require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const app = express();
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const folderRoutes = require('./routes/folderRoutes');
const excelRoutes = require('./routes/excelRoutes');
const sheetRoutes = require('./routes/sheetRoutes');
const columnRoutes = require('./routes/columnRoutes');
const rowRoutes = require('./routes/rowRoutes');
const accessRoutes = require('./routes/accessRoutes');



// ✅ Configure CORS properly
app.use(cors({
  origin: '*', // frontend URLs
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/excels', excelRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/rows', rowRoutes);
app.use('/api/access', accessRoutes);

app.use((req,res)=> res.status(404).json({ error: ' route Not Found' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
