import { Spin } from 'antd';

export default function PageLoader() {
  return (
    <div style={{
      minHeight: '40vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    >
      <Spin size="large" />
    </div>
  );
}
