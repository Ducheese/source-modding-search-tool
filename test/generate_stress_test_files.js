const fs = require('fs');
const path = require('path');

// --- 配置参数 ---
const NUM_FILES = 1200; // 要生成的文件数量 (可以根据需要调整)
const OUTPUT_DIR = './stress_test_data'; // 输出文件夹
const MIN_CONTENT_SIZE_MB = 0.01; // 每个文件的最小内容大小 (MB)
const MAX_CONTENT_SIZE_MB = 0.05; // 每个文件的最大内容大小 (MB)
const CHARACTER_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n\t.,;:"\'()[]{}!@#$%^&*-_+=?';
// 总预期大小约为：NUM_FILES * ((MIN + MAX) / 2) MB = 1200 * 0.03 MB ≈ 36 MB

/**
 * 生成指定字节长度的随机字符串。
 * @param {number} sizeInBytes - 字符串的预期字节长度。
 * @returns {string} - 生成的随机字符串。
 */
function generateRandomContent(sizeInBytes) {
    const charsPerByte = 1; // 假设大多数字符是单字节（ASCII或UTF-8常见字符）
    const targetLength = Math.floor(sizeInBytes / charsPerByte);
    let content = '';
    
    // 使用一个简单的伪随机生成器来快速填充内容
    while (content.length < targetLength) {
        // 每次生成一批字符以减少循环次数
        const batchSize = Math.min(1024, targetLength - content.length);
        let batch = '';
        for (let i = 0; i < batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * CHARACTER_SET.length);
            batch += CHARACTER_SET[randomIndex];
        }
        content += batch;
    }

    // 截断到准确的字节长度（尽管是近似值，但对于压力测试已经足够）
    // 为了效率，我们只截断字符串长度，实际字节数会非常接近
    return content.substring(0, targetLength); 
}

/**
 * 主函数：创建目录并生成文件。
 */
async function generateFiles() {
    console.log(`🚀 开始生成 ${NUM_FILES} 个测试文件...`);
    
    // 1. 创建输出目录 (如果不存在)
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 创建目录: ${OUTPUT_DIR}`);
    } else {
        console.log(`📁 目录 ${OUTPUT_DIR} 已存在，将覆盖文件。`);
    }

    const minSizeBytes = MIN_CONTENT_SIZE_MB * 1024 * 1024;
    const maxSizeBytes = MAX_CONTENT_SIZE_MB * 1024 * 1024;
    const startTime = Date.now();
    let totalSizeMB = 0;

    // 2. 循环生成文件
    for (let i = 1; i <= NUM_FILES; i++) {
        // 随机确定文件大小
        const fileSize = Math.floor(Math.random() * (maxSizeBytes - minSizeBytes + 1)) + minSizeBytes;
        
        // 生成内容
        const content = generateRandomContent(fileSize);
        
        // 确定文件名
        const fileName = `test_file_${i.toString().padStart(4, '0')}.txt`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // 使用同步写入（fs.writeFileSync）在 Node.js 脚本中效率更高，因为它避免了大量的Promise/回调开销，且文件写入本身是I/O密集型，不会阻塞其他事件。
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            totalSizeMB += content.length / (1024 * 1024);
        } catch (error) {
            console.error(`❌ 写入文件 ${fileName} 失败:`, error);
        }

        // 进度报告 (每100个文件报告一次)
        if (i % 100 === 0) {
            console.log(`✅ 已完成: ${i}/${NUM_FILES} (总大小约: ${totalSizeMB.toFixed(2)} MB)`);
        }
    }

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    console.log('\n--- 任务完成 ---');
    console.log(`🎉 成功生成 ${NUM_FILES} 个文件。`);
    console.log(`📊 总大小约: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`⏱️ 总耗时: ${durationSeconds.toFixed(2)} 秒`);
    console.log(`📁 文件保存在: ${path.resolve(OUTPUT_DIR)}`);
}

generateFiles();