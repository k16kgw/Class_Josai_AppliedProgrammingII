# 第11回　感染症モデル

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\text{仮定の設定}
\rightarrow
\underline{\text{数理モデルの構築}}
\rightarrow
\text{数値シミュレーション}
\rightarrow
\underline{\text{データとの比較}}
\rightarrow
\text{パラメタ推定}
\rightarrow
\text{モデルの検証と改善}
$$

第10回では，被食者と捕食者という2つの状態変数が相互作用する連立微分方程式を扱った．
今回は状態変数を3つに増やし，感染症の流行を表すSIRモデルを組み立てる．
モデルの形は $\boldsymbol{x}' = \boldsymbol{f}(t, \boldsymbol{x}; \boldsymbol{\theta})$ であり，これまでに学んだ要素がすべて現れる．

- 集団を「感受性」「感染」「回復」の3つの区画に分け，区画の間の移動を式にする（コンパートメントモデル）
- 3つの区画の合計は一定である．第6回のダムと同じ保存則がここでも成り立つ
- 公開されている新規陽性者数は，モデルの状態変数そのものではない．観測量と状態変数の対応をこれまで以上に丁寧に考える必要がある

## 今回の到達目標

- 感受性者，感染者，回復者の3区画と，区画間の流れを図で説明できる
- 「感染」と「回復」の流れから，SIRモデルの各式を自分で組み立て，各項の意味と単位を説明できる
- `solve_ivp`でSIRモデルを解き，$S + I + R = N$ が数値的に保たれることを確認できる
- 感染率 $\beta$，回復率 $\gamma$，初期感染者数 $I_0$ を変えたときの流行曲線の変化を説明し，基本再生産数 $R_0 = \beta / \gamma$ の意味を述べられる
- 公開データの新規陽性者数がモデルの $I(t)$ ではなく新規感染の発生数に対応することを説明し，観測モデルを使って実データに当てはめられる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第10回の復習，新規陽性者数データの確認（演習0） | 10分 |
| 2 | 3区画の図，感染と回復の流れ，SIRモデルの導出 | 25分 |
| 3 | `solve_ivp`による実装，保存則の確認，観測モデル | 20分 |
| 4 | パラメタと初期値の比較，第7波への当てはめ（演習1〜4） | 35分 |
| 5 | モデルに足りないものの共有，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第10回のLotka–Volterraモデルでは，状態変数をベクトル $\boldsymbol{x} = (x, y)$ とし，右辺の関数が2つの値を返すようにして`solve_ivp`に渡した．
解は`sol.y[0]`と`sol.y[1]`に入った．
今回も同じ書き方で，状態変数を3つにする．

もう1つ思い出しておきたいのは第6回の保存則である．
ダムでは「貯水量の変化＝流入－流出」と考え，水がどこかへ消えたり湧いたりしないことを式に組み込んだ．
感染症モデルでも，人は3つの区画のどれかに必ず属し，区画の間を移るだけで総数は変わらない，と考える．
この考え方が，3本の式を1本ずつ書くときの指針になる．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第11回の作業フォルダを作成する．データフォルダは共通のものを使う．

```bash
mkdir -p ~/applied_programming_ii/11
cd ~/applied_programming_ii/11
mkdir -p notebooks reports/figures
```

2. 講義サイトの[授業用データ一覧](../data/README.md)から`covid19_new_cases_daily.csv`をダウンロードし，`~/applied_programming_ii/data/`に置く．

3. `notebooks/sir_model.ipynb`を新規作成する．

4. `11`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第11回

- 氏名：
- 学籍番号：

## 今日の目標

SIRモデルを組み立てて実装し，パラメタの影響を調べ，新規陽性者数データに当てはめる．

## 計算条件（基本シミュレーション）

- 状態変数：S（感受性者），I（感染者），R（回復者）［人］
- 総人口：N = 100000 人
- パラメタ：beta = 0.3 /日，gamma = 0.1 /日
- 初期条件：I(0) = 10 人，R(0) = 0 人，S(0) = N - 10 人
- 計算区間：0〜200日

## 演習1〜3の記録

| 変えたもの | 値 | ピークの日 | ピークの感染者数 | 最終的な回復者の割合 |
| --- | --- | --- | --- | --- |

## 演習4の記録

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

PROJECT_DIR = Path.home() / "applied_programming_ii" / "11"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("感染者数データの有無:", (DATA_DIR / "covid19_new_cases_daily.csv").exists())
```
````

## 導入：新規陽性者数の波

厚生労働省が公開していた新型コロナウイルス感染症の新規陽性者数を読み込む．
2020年1月16日から，全数把握が終了した2023年5月8日までの，報告日ごとの人数である．

```python
cases = pd.read_csv(DATA_DIR / "covid19_new_cases_daily.csv", parse_dates=["date"])

# 曜日による報告数の偏りを弱めるため，前後3日を含む7日間の平均を計算する．
cases["japan_7d"] = cases["new_cases_japan"].rolling(7, center=True).mean()

print(cases.head())
print("期間:", cases["date"].min().date(), "〜", cases["date"].max().date(), " 日数:", len(cases))
print("最大の日別報告数:", int(cases["new_cases_japan"].max()), "人")
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(cases["date"], cases["new_cases_japan"], color="lightgray", linewidth=0.8, label="daily reported cases")
ax.plot(cases["date"], cases["japan_7d"], color="black", linewidth=1.5, label="7-day centered mean")
ax.set_title("Newly confirmed COVID-19 cases in Japan (reported daily)")
ax.set_xlabel("Date")
ax.set_ylabel("New cases [persons/day]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "covid_japan_daily.png", dpi=150)
plt.show()
```

図にはいくつもの「波」がある．
どの波も，増え始め，ピークを迎え，減っていく．
波が起きる仕組みを，最も単純な形で式にしたものがSIRモデルである．

薄い灰色の線は曜日によって大きく上下している．
週末は検査数が減り，週明けに報告がまとまるためで，これは感染の仕組みではなく観測の仕組みによる変動である．
モデルと比べるときは，7日間の平均（黒い線）を使う．

```{tip} 報告数は感染者数ではない
この表の数字は「その日に陽性と報告された人数」である．
感染した日でも発症した日でもなく，検査を受けなかった感染者は含まれない．
第1回で区別した「観測量」と「状態変数」の違いが，ここでは特に大きい．
今回の後半で，この違いをモデルに組み込む．
```

## 感染症の流れを図にする

### 3つの区画

集団の一人一人を，ある時刻にどの状態にあるかで3つに分ける．

- $S(t)$：**感受性者**．まだ感染しておらず，感染する可能性がある人の数
- $I(t)$：**感染者**．現在感染しており，他人に感染させる可能性がある人の数
- $R(t)$：**回復者**．回復して免疫を持つ，または隔離されて感染させない人の数

```{tip} 記号 $S$ の意味は第8回と異なる
第8回では $S$ をタンクの貯留量の意味で使った．
今回から $S$ は感受性者の数を表す．
講義全体で記号は回ごとに一貫させているが，異なる回で同じ文字を別の意味に使う場合はこのように明記する．
```

人は $S \to I \to R$ の順に区画を移る．
逆方向の移動はないと仮定する．

```{mermaid}
flowchart LR
    S["S: 感受性者"] -->|"感染  βSI/N"| I["I: 感染者"]
    I -->|"回復  γI"| R["R: 回復者"]
```

### 置く仮定

式を書く前に，仮定を言葉で並べる．

1. 総人口 $N = S + I + R$ は一定である．出生，死亡，転入，転出は考えない
2. 集団は一様に混ざっている．誰もが誰とでも同じ確率で接触する
3. 感染者一人が単位時間あたりに他人と接触して感染させる回数は，相手が感受性者である割合 $S/N$ に比例する
4. 感染者は一定の割合 $\gamma$ で回復し，回復した人は再び感染しない
5. 感染してすぐに他人に感染させられる．潜伏期間は考えない

どの仮定も現実と食い違う点を含む．
食い違いが結果にどう現れるかを，あとで実データと比べながら考える．

## 各項を組み立てる

### 感染の流れ

感染者一人が1日に接触する人数を $c$ 人，1回の接触で感染が起きる確率を $p$ とする．
接触相手が感受性者である割合は $S/N$ なので，感染者一人が1日に新たに感染させる人数は $c\,p\,S/N$ である．
感染者は $I$ 人いるから，集団全体で1日に新たに感染する人数は

$$
c\,p\,\frac{S}{N}\,I = \beta\,\frac{S\,I}{N},
\qquad \beta = c\,p
$$

となる．
$\beta$ を**感染率**と呼ぶ．単位は 1／日である．
$c$ と $p$ を別々に決めることはできないので，積 $\beta$ を1つのパラメタとして扱う．

この人数が，1日あたりに $S$ から出て $I$ に入る．

### 回復の流れ

感染者は平均して $1/\gamma$ 日で回復すると仮定する．
すると，1日あたりに回復する人数は $\gamma I$ である．
$\gamma$ を**回復率**と呼ぶ．単位は 1／日である．
例えば平均感染期間が7日なら $\gamma = 1/7 \approx 0.143$ である．

この人数が，1日あたりに $I$ から出て $R$ に入る．

### SIRモデル

各区画について「入る流れ－出る流れ」を書けば，3本の式ができる．

$$
\begin{aligned}
\frac{dS}{dt} &= -\beta\,\frac{S\,I}{N} \\
\frac{dI}{dt} &= \beta\,\frac{S\,I}{N} - \gamma\,I \\
\frac{dR}{dt} &= \gamma\,I
\end{aligned}
$$

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $\beta S I / N$ | 1日に新たに感染する人数．$S$ から $I$ への流れ | 人／日 |
| $\gamma I$ | 1日に回復する人数．$I$ から $R$ への流れ | 人／日 |
| $\beta$ | 感染率．感染者一人が1日に，全員が感受性者だったとして感染させる人数 | 1／日 |
| $\gamma$ | 回復率．平均感染期間の逆数 | 1／日 |
| $N$ | 総人口 | 人 |

3本の式を足すと右辺は $0$ になる．

$$
\frac{dS}{dt} + \frac{dI}{dt} + \frac{dR}{dt} = 0
\quad\Longrightarrow\quad
S(t) + I(t) + R(t) = N
$$

区画の間を移るだけで人は消えないという仮定1が，式の形として保証されている．
数値計算の結果でもこの関係が保たれているかを，あとで確かめる．

```{tip} 各項の符号を確認する
$S$ の式には負の項しかない．感受性者は減るだけである．
$R$ の式には正の項しかない．回復者は増えるだけである．
$I$ の式には入る流れと出る流れの両方があり，$\beta S I / N > \gamma I$ のとき増え，逆のとき減る．
つまり，感染者数が増えるか減るかは $\beta S / N$ と $\gamma$ の大小で決まる．
この観察が，あとで出てくる基本再生産数の意味につながる．
```

## Pythonによる最小構成の実装

第10回と同じく，状態変数をまとめた配列`state`を受け取り，3つの変化率をリストで返す関数を書く．

```python
def sir_rhs(t, state, beta, gamma, N):
    """SIRモデルの右辺．state = [S, I, R] を受け取り，[dS/dt, dI/dt, dR/dt] を返す．"""
    S, I, R = state
    new_infections = beta * S * I / N    # 感染の流れ [人/日]
    recoveries = gamma * I               # 回復の流れ [人/日]
    return [-new_infections, new_infections - recoveries, recoveries]
```

架空の10万人の集団で，最初に10人の感染者がいる場合を計算する．

```python
# 総人口とパラメタ
N = 100000.0     # 総人口 [人]
beta = 0.3       # 感染率 [1/日]
gamma = 0.1      # 回復率 [1/日]（平均感染期間 10日）

# 初期条件
I0 = 10.0
R0_init = 0.0
S0 = N - I0 - R0_init
state0 = [S0, I0, R0_init]

# 計算区間
t_span = (0.0, 200.0)
t_eval = np.arange(0.0, 201.0)     # 1日ごとに出力

sol = solve_ivp(sir_rhs, t_span, state0, t_eval=t_eval, args=(beta, gamma, N))
S, I, R = sol.y

print("成功したか:", sol.success)
print(f"感染者数のピーク: {I.max():.0f} 人（{int(t_eval[I.argmax()])} 日目）")
print(f"200日後の回復者数: {R[-1]:.0f} 人（総人口の {100 * R[-1] / N:.1f}%）")
print(f"S + I + R - N の最大のずれ: {np.max(np.abs(S + I + R - N)):.2e} 人")
```

最後の行が保存則の数値的な確認である．
ずれは $10^{-10}$ 人程度で，計算機の丸め誤差の範囲に収まっている．
もしここが大きな値になったら，右辺の関数の符号か項の書き忘れを疑う．

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(sol.t, S, label="S: susceptible")
ax.plot(sol.t, I, label="I: infectious")
ax.plot(sol.t, R, label="R: recovered")
ax.set_title(f"SIR model (N = {N:.0f}, beta = {beta}, gamma = {gamma}, I0 = {I0:.0f})")
ax.set_xlabel("Time [day]")
ax.set_ylabel("Number of persons")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sir_basic.png", dpi=150)
plt.show()
```

感染者数 $I$ は最初ゆっくり増え，加速し，ピークを過ぎると減る．
一方で，200日後にも感受性者が約6%残っている．
流行は，全員が感染する前に自然に終わる．
感染者が減るのは，感受性者が減って新しい感染が起きにくくなるためである．

## パラメタや初期条件を変える演習

同じ条件で複数のシミュレーションを行うために，計算と要約を関数にまとめる．

```python
def run_sir(beta, gamma, N, I0, t_end=200.0):
    """SIRモデルを解き，時刻，S，I，R の配列を返す．"""
    t_eval = np.arange(0.0, t_end + 1.0)
    sol = solve_ivp(sir_rhs, (0.0, t_end), [N - I0, I0, 0.0], t_eval=t_eval, args=(beta, gamma, N))
    return sol.t, sol.y[0], sol.y[1], sol.y[2]


def summarize_sir(t, S, I, R, N):
    """ピークの日，ピークの感染者数，最終的な回復者の割合を返す．"""
    return int(t[I.argmax()]), I.max(), R[-1] / N
```

````{note} 演習1：感染率 $\beta$ を変える

次のコードを実行し，`README.md`の表に結果を記録する．

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
for beta_trial in [0.2, 0.3, 0.4, 0.6]:
    t, S, I, R = run_sir(beta_trial, gamma, N, I0)
    peak_day, peak_I, final_R = summarize_sir(t, S, I, R, N)
    print(f"beta = {beta_trial:.1f}: ピーク {peak_day:3d} 日目，{peak_I:7.0f} 人，最終回復者割合 {100 * final_R:5.1f}%")
    ax.plot(t, I, label=f"beta = {beta_trial}")
ax.set_title(f"Infectious I(t) for different beta (gamma = {gamma})")
ax.set_xlabel("Time [day]")
ax.set_ylabel("Infectious [persons]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sir_vary_beta.png", dpi=150)
plt.show()
```

1. $\beta$ を大きくすると，ピークの時刻，ピークの高さ，最終的に感染した人の割合はそれぞれどう変わるか．
2. $\beta = 0.2$ と $\beta = 0.6$ では，最終的に感染しなかった人の割合がどれだけ違うか．
3. 現実の対策（マスク，接触機会の削減）は，モデルのどのパラメタを変えることに対応するか．
````

````{note} 演習2：回復率 $\gamma$ を変える

演習1のコードを参考に，$\beta = 0.3$ を固定して $\gamma$ を`0.05, 0.1, 0.15, 0.25`と変え，同じ表を作る．

1. $\gamma$ を大きくする（平均感染期間を短くする）と，流行はどう変わるか．
2. $\gamma = 0.25$ のとき，$\beta / \gamma$ の値はいくらか．感染者数は増えるか減るか．
3. $\beta = 0.3, \gamma = 0.1$ と $\beta = 0.6, \gamma = 0.2$ を比べる．$\beta / \gamma$ は同じだが，流行の形は同じか．
````

````{note} 演習3：初期感染者数 $I_0$ を変える

$\beta = 0.3$，$\gamma = 0.1$ を固定し，$I_0$ を`1, 10, 100, 1000`と変える．

1. $I_0$ を10倍にすると，ピークの時刻はどれだけ早まるか．ピークの高さはどれだけ変わるか．
2. 初期感染者数を早期に抑えることは，流行の「何」を変え，「何」を変えないか．
````

```{dropdown} 演習1〜3の確認
- $\beta$ を0.3から0.4に上げると，ピークは50日目から35日目に早まり，高さは約3.0万人から約4.0万人に上がる．最終的な回復者割合は94%から98%に上がる．
- $\gamma$ を0.1から0.15に上げると，ピークは61日目に遅れ，高さは約1.5万人に下がり，最終回復者割合は80%に下がる．$\gamma = 0.25$ では $\beta / \gamma = 1.2$ で流行は起きるが小さい．$\gamma = 0.3$ 以上では $\beta / \gamma \le 1$ となり，感染者数は最初から減る．
- $\beta = 0.6, \gamma = 0.2$ は $\beta = 0.3, \gamma = 0.1$ と同じ最終回復者割合になるが，すべてが2倍の速さで進む．$\beta / \gamma$ は流行の大きさを，$\beta$ と $\gamma$ の絶対値は速さを決める．
- $I_0$ を10人から100人にすると，ピークは50日目から38日目に早まるが，高さと最終回復者割合はほとんど変わらない．初期感染者数は流行の時期を動かすが，規模は動かさない．
```

### 基本再生産数の意味

演習の結果は，$\beta / \gamma$ という比で整理できる．
この比を**基本再生産数**と呼び，$R_0$ と書く．

$$
R_0 = \frac{\beta}{\gamma}
$$

意味は次のとおりである．
感染者一人は1日に $\beta$ 人（全員が感受性者なら）に感染させ，平均 $1/\gamma$ 日間感染力を持つ．
したがって，全員が感受性者の集団に感染者一人が入ったとき，その人が感染させる人数の平均が $\beta \times 1/\gamma = R_0$ である．

- $R_0 > 1$ なら，一人が一人以上に感染させるので，感染者数は最初増える
- $R_0 < 1$ なら，一人が一人未満にしか感染させないので，感染者数は最初から減る

流行の途中では，感受性者の割合 $S/N$ が減っているので，実際に一人が感染させる人数は $R_0 \times S/N$ になる．
これが1を下回った時点がピークである．
$\beta = 0.3$，$\gamma = 0.1$ なら $R_0 = 3$ で，$S/N = 1/3$ になったときにピークを迎える．

```{tip} $R_0$ は「モデルの中の」量である
$R_0$ はモデルのパラメタから決まる量であり，ウイルスだけの性質ではない．
接触の頻度 $c$ は社会の状況によって変わるから，同じ病原体でも $R_0$ は集団や時期によって変わる．
報道で見る「実効再生産数」は，この $R_0 \times S/N$ に対策の効果なども含めて，観測データから推定したものである．
```

## 観測量と状態変数：新規陽性者数は $I(t)$ ではない

ここまでの図では感染者数 $I(t)$ を描いた．
しかし，冒頭で読み込んだデータは「その日に新たに報告された人数」である．
これはモデルのどの量に対応するか．

「その日に新たに感染した人数」は，$S$ から $I$ への流れ，すなわち

$$
c(t) = \beta\,\frac{S(t)\,I(t)}{N}
\qquad [\text{人／日}]
$$

である．
$I(t)$ は「その時点で感染している人の総数」であり，何日か前に感染した人が積み重なった量である．
2つは別の量で，時間のずれもある．

```python
def daily_new_infections(t, S, I, beta, N):
    """SIRモデルの解から，1日あたりの新規感染者数 beta * S * I / N を計算する．"""
    return beta * S * I / N


t, S, I, R = run_sir(beta, gamma, N, I0)
new_inf = daily_new_infections(t, S, I, beta, N)

print(f"I(t) のピーク:           {int(t[I.argmax()])} 日目，{I.max():.0f} 人")
print(f"新規感染者数のピーク:    {int(t[new_inf.argmax()])} 日目，{new_inf.max():.0f} 人/日")
print(f"200日間の新規感染の合計: {new_inf.sum():.0f} 人（最終的な R = {R[-1]:.0f} 人）")

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t, I, label="I(t): currently infectious [persons]")
ax.plot(t, new_inf, linestyle="--", label="new infections per day [persons/day]")
ax.set_title("State variable I(t) vs. observable daily new infections")
ax.set_xlabel("Time [day]")
ax.set_ylabel("Persons or persons/day")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sir_I_vs_incidence.png", dpi=150)
plt.show()
```

新規感染者数のピークは $I(t)$ のピークより早い．
また，新規感染者数を200日分足し合わせると，最終的な回復者数とほぼ一致する．
$S$ から出た人は最終的に全員 $R$ にたどり着くからである．

公開データと比べるときは，$I(t)$ ではなく $c(t)$ をモデルの出力として使う．
このように，状態変数から観測量を計算する式を**観測モデル**と呼ぶ．
本当は，報告されるのは感染者の一部だけであり，感染から報告まで数日の遅れもある．
今回は「新規感染者はすべて，感染した日に報告される」という単純な観測モデルを置き，改良は発展演習に回す．

## オープンデータとの比較：第7波への当てはめ

### 対象とする波を切り出す

複数の波が重なった全期間に単純なSIRモデルを当てることはできない．
1つの波だけを切り出す．
ここでは2022年夏の第7波（2022年7月1日〜9月30日，92日間）を使う．
この期間は増加から減少までが1つの山として比較的きれいに現れている．

```python
wave_start, wave_end = "2022-07-01", "2022-09-30"
wave = cases[(cases["date"] >= wave_start) & (cases["date"] <= wave_end)].reset_index(drop=True)

y_obs = wave["japan_7d"].to_numpy()                 # 観測値：7日平均の新規報告数 [人/日]
t_obs = np.arange(len(y_obs), dtype=float)          # 0日目 = 2022-07-01

print("日数:", len(y_obs))
print(f"観測のピーク: {y_obs.max():.0f} 人/日（{wave['date'][y_obs.argmax()].date()}）")
print(f"期間の初日: {y_obs[0]:.0f} 人/日，最終日: {y_obs[-1]:.0f} 人/日")
```

### 当てはめの手順

第7回と同じく，観測値とモデル出力の差を残差ベクトルとして`least_squares`に渡す．
モデル出力は観測モデル $c(t) = \beta S I / N$ である．

```python
def simulate_new_infections(beta, gamma, N, I0, t_eval):
    """パラメタと初期感染者数から，各日の新規感染者数 [人/日] を計算する．"""
    sol = solve_ivp(sir_rhs, (t_eval[0], t_eval[-1]), [N - I0, I0, 0.0], t_eval=t_eval, args=(beta, gamma, N), rtol=1e-6)
    S, I, R = sol.y
    return beta * S * I / N
```

### 最初の試み：総人口を $N$ にして $\beta$，$\gamma$，$I_0$ を推定する

まず素直に，日本の総人口約1.25億人を $N$ とし，$\beta$，$\gamma$，$I_0$ の3つを推定してみる．

```python
N_japan = 1.25e8


def residuals_naive(params):
    beta_p, gamma_p, I0_p = params
    return simulate_new_infections(beta_p, gamma_p, N_japan, I0_p, t_obs) - y_obs


result_naive = least_squares(residuals_naive, x0=[0.5, 0.2, 1e5], bounds=([0.01, 0.01, 1.0], [5.0, 2.0, 1e7]))
beta_n, gamma_n, I0_n = result_naive.x
y_naive = simulate_new_infections(beta_n, gamma_n, N_japan, I0_n, t_obs)
rmse_naive = np.sqrt(np.mean((y_naive - y_obs) ** 2))

print(f"beta = {beta_n:.3f} /日,  gamma = {gamma_n:.3f} /日（平均感染期間 {1 / gamma_n:.1f} 日）")
print(f"R0 = beta/gamma = {beta_n / gamma_n:.3f},  I0 = {I0_n:.0f} 人")
print(f"RMSE = {rmse_naive:.0f} 人/日")
```

当てはまりの数字だけ見れば悪くない．
しかし推定値は，平均感染期間が1日足らず，$R_0$ が1.05という，現実離れしたものになる．
1.25億人の集団で $S$ がほとんど減らないため，山の形を作るには「$\beta$ と $\gamma$ がほぼ等しく，どちらも大きい」という組合せしか残らないのである．
データに合う値が，現象として意味のある値とは限らない．
これは第5回で触れた識別可能性の問題でもある．

### 2回目の試み：知識を使って $\gamma$ を固定し，実効的な集団の大きさを推定する

回復率については，モデルの外から情報がある．
感染力を持つ期間は平均でおよそ1週間とされるので，$\gamma = 1/7$ に固定する．
その代わり，「この波で実際に感染に関わった集団の大きさ」を $N_{\mathrm{eff}}$ という未知のパラメタにする．
全国民が一様に混ざっているという仮定2が成り立たないことを，$N$ を小さくすることで粗く補うわけである．

```python
gamma_fixed = 1.0 / 7.0


def residuals_sir(params):
    beta_p, N_eff_p, I0_p = params
    return simulate_new_infections(beta_p, gamma_fixed, N_eff_p, I0_p, t_obs) - y_obs


result_sir = least_squares(
    residuals_sir,
    x0=[0.3, 1e7, 2e5],
    bounds=([0.01, 1e5, 1.0], [3.0, N_japan, 1e7]),
    x_scale=[0.1, 1e6, 1e5],
)
beta_hat, N_eff_hat, I0_hat = result_sir.x
y_sir = simulate_new_infections(beta_hat, gamma_fixed, N_eff_hat, I0_hat, t_obs)
rmse_sir = np.sqrt(np.mean((y_sir - y_obs) ** 2))

print(f"beta = {beta_hat:.4f} /日,  gamma = {gamma_fixed:.4f} /日（固定）")
print(f"R0 = {beta_hat / gamma_fixed:.2f}")
print(f"N_eff = {N_eff_hat:.3e} 人（総人口の {100 * N_eff_hat / N_japan:.1f}%）,  I0 = {I0_hat:.0f} 人")
print(f"RMSE = {rmse_sir:.0f} 人/日")
print(f"モデルのピーク: {y_sir.max():.0f} 人/日（{wave['date'][y_sir.argmax()].date()}），観測のピーク: {wave['date'][y_obs.argmax()].date()}")
```

`x_scale`は，パラメタの桁が大きく違うときに最適化を安定させるための目安である．
推定された $\beta$ は約0.22／日で，$R_0 \approx 1.5$ になる．
$N_{\mathrm{eff}}$ は約2100万人，総人口の17%程度である．

```python
fig, axes = plt.subplots(2, 1, figsize=(9, 7), sharex=True)

axes[0].plot(wave["date"], y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed (7-day mean)")
axes[0].plot(wave["date"], y_naive, linestyle=":", label=f"SIR, N = 1.25e8, beta, gamma free (RMSE {rmse_naive:.0f})")
axes[0].plot(wave["date"], y_sir, linestyle="-", label=f"SIR, gamma = 1/7, N_eff estimated (RMSE {rmse_sir:.0f})")
axes[0].set_title("7th wave in Japan (2022-07-01 to 2022-09-30): observed vs. SIR")
axes[0].set_ylabel("New cases [persons/day]")
axes[0].grid(True)
axes[0].legend()

axes[1].plot(wave["date"], y_obs - y_sir, marker="o", markersize=3, linestyle="-")
axes[1].axhline(0, color="gray")
axes[1].set_title("Residuals: observed - SIR (gamma = 1/7)")
axes[1].set_xlabel("Date")
axes[1].set_ylabel("Residual [persons/day]")
axes[1].grid(True)

fig.tight_layout()
fig.savefig(FIGURE_DIR / "covid_wave7_sir_fit.png", dpi=150)
plt.show()
```

上の図で2つの当てはめはほとんど重なるが，パラメタの意味はまったく違う．
下の残差の図を見ると，モデルは観測より早くピークを迎え，8月後半から9月にかけては観測のほうが多い．
残差が正と負の期間にまとまって現れるのは，観測のばらつきではなく，モデルの構造が現象と食い違っていることの現れである．
何が足りないかを次に考える．

````{note} 演習4：観測モデルの仮定を確認する

1. `cases["new_cases_japan"]`（7日平均をとる前の値）で同じ当てはめを行い，RMSEがどう変わるかを記録する．なぜ7日平均を使うほうがよいかを`README.md`に書く．
2. `wave_start`を`"2022-06-20"`に変えて当てはめ直し，$\beta$，$N_{\mathrm{eff}}$，$R_0$ がどれだけ変わるかを記録する．波の切り出し方で推定値が変わることは，何を意味するか．
3. 推定された $N_{\mathrm{eff}}$ が総人口より大幅に小さいことを，モデルの5つの仮定のうちどれと関係づけて説明できるか．
````

## モデルの限界と改善の問い

当てはめの結果は，SIRモデルに足りないものを教えてくれる．

- **報告の遅れと報告率**．感染から報告まで数日かかり，検査を受けない感染者もいる．観測モデルに遅れと報告率 $\rho$ を入れる必要がある
- **一様混合の仮定**．全国民が一様に接触しているわけではない．$N_{\mathrm{eff}}$ が総人口の17%になったのは，この仮定の破れを表している
- **行動の変化**．流行が報道されると人々は接触を減らし，$\beta$ が時間とともに下がる．ピーク後に観測が減りにくいのは，逆に対策が緩んだ影響かもしれない
- **免疫の減衰と再感染**．回復者が再び感受性者に戻る流れ（$R \to S$）を考えないと，複数の波は説明できない
- **潜伏期間**．感染してから感染力を持つまでの期間があり，これはピークの時期を遅らせる

「SIRモデルは間違っている」と結論するのではなく，「どの仮定を緩めれば，どの食い違いが説明できるか」を考えることが，第12回のモデルの発展につながる．

````{dropdown} 発展演習：報告率を観測モデルに入れる

新規感染者のうち割合 $\rho$ だけが報告されると仮定し，観測モデルを $y(t) = \rho\,\beta S I / N$ とする．
$N$ は総人口1.25億人に固定し，$\gamma = 1/7$ として，$\beta$，$I_0$，$\rho$ を推定する．

```python
def residuals_reporting(params):
    beta_p, I0_p, rho_p = params
    return rho_p * simulate_new_infections(beta_p, gamma_fixed, N_japan, I0_p, t_obs) - y_obs


result_rho = least_squares(
    residuals_reporting,
    x0=[0.3, 1e6, 0.3],
    bounds=([0.01, 1.0, 0.01], [3.0, 5e7, 1.0]),
    x_scale=[0.1, 1e5, 0.1],
)
beta_r, I0_r, rho_r = result_rho.x
y_rho = rho_r * simulate_new_infections(beta_r, gamma_fixed, N_japan, I0_r, t_obs)
print(f"beta = {beta_r:.4f} /日,  R0 = {beta_r / gamma_fixed:.2f},  rho = {rho_r:.3f},  I0 = {I0_r:.0f} 人")
print(f"RMSE = {np.sqrt(np.mean((y_rho - y_obs) ** 2)):.0f} 人/日")
```

1. $\beta$ と $R_0$ の推定値は，$N_{\mathrm{eff}}$ を推定したときと比べてどうか．
2. 「報告率 $\rho$ が低い」と「実効的な集団 $N_{\mathrm{eff}}$ が小さい」は，データからは区別できるか．曲線の形だけからは区別できないパラメタの組を，識別できないという．
3. 感染から報告までの遅れ $d$ 日を入れるには，モデル出力をどうずらせばよいか．コードの変更案を書く．
````

## まとめ

- SIRモデルは，集団を感受性者 $S$，感染者 $I$，回復者 $R$ の3区画に分け，感染の流れ $\beta S I / N$ と回復の流れ $\gamma I$ で区画間の移動を表す
- 3本の式の和は0であり，$S + I + R = N$ が保たれる．数値計算でもこれを確認する
- $\beta$ は流行の速さと規模を，$\gamma$ は平均感染期間を決める．基本再生産数 $R_0 = \beta / \gamma$ は，全員が感受性者の集団で感染者一人が感染させる人数であり，$R_0 > 1$ のときだけ流行が起きる
- 初期感染者数 $I_0$ は流行の時期を動かすが，規模はほとんど動かさない
- 公開される新規陽性者数は $I(t)$ ではなく，新規感染の発生数 $\beta S I / N$ に（報告率と遅れを介して）対応する．状態変数から観測量を計算する式が観測モデルである
- データに合う推定値が現象として意味のある値とは限らない．知識で固定できるパラメタは固定し，残差の偏りからモデルの不足を読む

## 課題

````{warning} 課題1：別の波，別の地域への当てはめ

次の2つのうち1つを選び，本文と同じ手順（7日平均，$\gamma = 1/7$ 固定，$\beta$，$N_{\mathrm{eff}}$，$I_0$ の推定）で当てはめを行う．

- 第8波：`cases["japan_7d"]`の2022年11月1日〜2023年1月31日
- 埼玉県の第7波：`cases["new_cases_saitama"]`に7日平均をとり，2022年7月1日〜9月30日

1. 推定された $\beta$，$R_0$，$N_{\mathrm{eff}}$，RMSEを表にし，本文の第7波（全国）の結果と並べる．
2. 観測値，モデル，残差の図を作成し，`reports/figures/`に保存する．
3. 残差の時系列に偏りがあれば，どの期間にどの向きに偏っているかを書く．
````

````{warning} 課題2：観測量と状態変数

次の問いに300字程度で答える．

「新規陽性者数が減り始めた」というニュースを聞いたとき，モデルの $I(t)$ もその日に減り始めていると言えるか．
新規感染者数 $\beta S I / N$ と $I(t)$ の関係，感染から報告までの遅れ，報告率の3点を踏まえて説明する．
また，全数把握が終了した2023年5月以降に同じモデルを当てようとすると，観測モデルの何が変わるかを述べる．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

今回の当てはめでは，RMSEだけを見れば2つの推定はほぼ同じだったが，パラメタの意味はまったく違った．
また，残差には期間ごとの偏りがあった．
第12回では，「当てはまりの良さ」だけでモデルを評価してはいけない理由を整理し，残差の時系列，訓練期間と検証期間の分割，複数モデルの比較，誤差の種類の区別を扱う．
そのうえで，SIRモデルに潜伏期間，ワクチン，行動変容などを加える拡張案を，各自で状態遷移図と式にする．
今回の`sir_rhs`，`simulate_new_infections`，第7波の切り出しコードはそのまま使うので，Notebookを手元に残しておく．

## 自分の言葉で説明する問い

1. SIRモデルの3本の式を，「入る流れ」と「出る流れ」という言葉を使って，式を見ずに説明せよ．
2. 基本再生産数 $R_0 = \beta / \gamma$ の意味を説明し，$R_0 > 1$ のときと $R_0 < 1$ のときで何が違うかを述べよ．
3. 公開される新規陽性者数は，SIRモデルのどの量に対応するか．$I(t)$ と何が違うかを説明せよ．
4. 総人口を $N$ にして $\beta$ と $\gamma$ を推定したとき，当てはまりは良いのに推定値が現実離れした．このことから，パラメタ推定について何を学ぶべきか．
