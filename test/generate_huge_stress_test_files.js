const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // 引入crypto模块用于生成更高质量的随机数据

// --- 升级版配置参数 ---
const NUM_FILES = 100; // 文件数量：减少数量，增加单个文件大小以确保总大小足够 (可调)
const OUTPUT_DIR = './huge_stress_test_data'; // 输出文件夹
const MIN_CONTENT_SIZE_MB = 2; // 每个文件的最小内容大小 (MB)
const MAX_CONTENT_SIZE_MB = 10; // 每个文件的最大内容大小 (MB)
// 总预期大小约为：100 * ((2 + 10) / 2) MB = 600 MB (巨大的压力)

// 包含 ASCII 字符、UTF-8 多字节字符、标点符号、数字等，以增加处理复杂度
const CHARACTER_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n\t.,;:"\'()[]{}!@#$%^&*-_+=?<>/|\\`~' +
                      '中文测试样本样本样本' + // 增加中文多字节字符
                      'áéíóúüñ¿¡€£¥₽';        // 增加其他多字节特殊字符

/**
 * 生成指定字节长度的随机字符串，使用更复杂的字符集。
 * @param {number} sizeInBytes - 字符串的预期字节长度。
 * @returns {string} - 生成的随机字符串。
 */
function generateHighEntropyContent(sizeInBytes) {
    let content = '';
    const charSetLength = CHARACTER_SET.length;
    let currentByteCount = 0;

    // 预估字符数
    const avgBytesPerChar = 1.5; // 估算，因为包含中文字符
    const targetCharLength = Math.floor(sizeInBytes / avgBytesPerChar);

    // 循环生成内容，直到接近目标字节数
    while (content.length < targetCharLength) {
        // 使用 crypto.randomInt 确保随机性高于 Math.random
        const randomIndex = crypto.randomInt(0, charSetLength);
        const char = CHARACTER_SET[randomIndex];
        content += char;

        // 粗略估算字节数，如果过于复杂会影响效率，这里主要以字符长度控制为主
    }

    // 最终截断或调整，以确保文件大小在合理范围内
    return content.substring(0, targetCharLength); 
}

/**
 * 主函数：创建目录并生成文件。
 */
async function generateFiles() {
    console.log(`🚀 开始生成 ${NUM_FILES} 个高压力测试文件...`);
    console.log(`📏 文件大小范围: ${MIN_CONTENT_SIZE_MB}MB 到 ${MAX_CONTENT_SIZE_MB}MB`);
    
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
        
        // 生成高熵内容
        const content = generateHighEntropyContent(fileSize);
        
        // 确定文件名
        const fileName = `huge_file_${i.toString().padStart(3, '0')}.txt`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // 使用同步写入（fs.writeFileSync）保证写入速度和脚本流程控制
        try {
            // 使用 'utf8' 编码写入，确保多字节字符正确存储
            fs.writeFileSync(filePath, content, 'utf8');
            // 计算实际写入的字节数并转换为MB
            const actualSize = fs.statSync(filePath).size;
            totalSizeMB += actualSize / (1024 * 1024);
        } catch (error) {
            console.error(`❌ 写入文件 ${fileName} 失败:`, error);
        }

        // 进度报告 (每10个文件报告一次，因为文件少但大)
        if (i % 10 === 0) {
            console.log(`✅ 已完成: ${i}/${NUM_FILES} (总大小: ${totalSizeMB.toFixed(2)} MB)`);
        }
    }

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    console.log('\n--- 任务完成 ---');
    console.log(`🎉 成功生成 ${NUM_FILES} 个高压文件。`);
    console.log(`📊 实际总大小: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`⏱️ 总耗时: ${durationSeconds.toFixed(2)} 秒`);
    console.log(`📁 文件保存在: ${path.resolve(OUTPUT_DIR)}`);
}

generateFiles();