import React from 'react';

/**
 * 错误边界组件
 * 捕获渲染错误，防止白屏，显示友好的错误界面
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ marginBottom: '16px', color: '#d32f2f' }}>出错了</h1>
          <p style={{ marginBottom: '24px', color: '#666' }}>
            应用遇到了一个错误。请尝试刷新页面。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: '16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
          <details style={{ marginTop: '24px', maxWidth: '600px', overflow: 'auto' }}>
            <summary style={{ cursor: 'pointer', color: '#999' }}>错误详情</summary>
            <pre style={{ marginTop: '8px', fontSize: '12px', color: '#666', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
