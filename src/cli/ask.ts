import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { getFixFromLLM } from '.'; 
import { trim } from 'lodash';

export async function startChat() {
  console.log(chalk.green('\n💬 Welcome to LLM Chat! (type "exit" to quit)\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> ')
  });

  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    rl.pause();
    const spinner = ora('Thinking...').start();
    try {
      history.push({ role: 'user', content: input });
      const contextPrompt = history.map((entry) =>
        `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`
      ).join('\n') + '\nAssistant:';
      const response = await getFixFromLLM(contextPrompt);
      spinner.stop();
      const trimmed = response.trim();
      console.log(chalk.yellowBright('\nLLM:\n') + trimmed + '\n');
    } catch (err) {
      spinner.fail('Error during chat');
      console.error(err);
    }
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.gray('\n👋 Chat ended.\n'));
    process.exit(0);
  });
}
