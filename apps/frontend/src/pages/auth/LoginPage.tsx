import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";

type Props = {
  siteTitle: string;
  subtitle: string;
  error: string;
  onLogin: (username: string, password: string) => void;
};

export function LoginPage(props: Props): JSX.Element {
  const [form] = Form.useForm<{ username: string; password: string }>();

  return (
    <main className="login-layout">
      <Card className="login-card-antd">
        <Typography.Title level={2}>{props.siteTitle}</Typography.Title>
        <Typography.Paragraph type="secondary">{props.subtitle}</Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => props.onLogin(values.username, values.password)}
          initialValues={{ username: "", password: "" }}
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
        {props.error && <Alert style={{ marginTop: 12 }} type="error" showIcon message={props.error} />}
      </Card>
    </main>
  );
}
