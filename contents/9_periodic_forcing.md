# 第9回　観光・電力需要と周期的外力

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\underline{\text{仮定の設定}}
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

これまでのモデルの右辺 $f$ は，状態変数 $x$ だけで決まるか（第3〜5回），観測された入力 $u(t)$ を足したものだった（第6〜8回）．
今回は，右辺が時刻 $t$ そのものに陽に依存する $x' = f(t, x)$ の形を扱う．
題材は，訪日外客数と電力需要である．
どちらも「1年」「1週間」「1日」といった決まった周期で繰り返す変動を持ち，その周期性を式で表すところから始める．

今回は，微分方程式を無理に当てはめない回でもある．
周期的な変動を説明するには回帰的なモデルの方が自然な場合が多く，微分方程式モデルは「周期的な目標に向かって遅れて追いつく」という仕組みを表したいときに意味を持つ．
両者の違いを整理することが今回の目標の1つである．

## 今回の到達目標

- 時系列の図から，年周期，週周期，日周期などの周期性を読み取れる
- 正弦関数 $A\sin(2\pi t/T + \phi)$ の振幅，周期，位相が図の何に対応するかを説明できる
- ベースライン，トレンド，周期成分を組み合わせた周期モデルを最小二乗法で当てはめ，残差を図で示せる
- 周期的な目標値に緩和する微分方程式 $x' = -\lambda\,(x - g(t))$ を実装し，回帰的な周期モデルとの違いを説明できる
- 周期性だけでは説明できない要因を，残差の時系列から具体的に指摘できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第8回の復習，訪日外客数の時系列の観察（演習0） | 10分 |
| 2 | 正弦関数の振幅・周期・位相，周期モデルの構成，緩和モデルの導出 | 25分 |
| 3 | 最小二乗法による当てはめと残差，`solve_ivp`による緩和モデル | 20分 |
| 4 | 周期の追加，$\lambda$ の変更，残差の読み取り（演習1〜4） | 35分 |
| 5 | 周期性で説明できない要因の共有，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第6回から第8回では，ダムの貯水量を

$$
V' = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)
$$

と書き，流入量という観測データを時間依存の入力として与えた．
そこでは，入力 $Q_{\mathrm{in}}(t)$ は観測された値をそのまま補間して使った．

今回も右辺は時刻に依存するが，入力の与え方が異なる．
観測値を補間するのではなく，「1年周期で繰り返す」という仮定を式にした関数 $g(t)$ を右辺に置く．
つまり，時間依存の入力そのものをモデル化する．

| 回 | 右辺の形 | 時間依存の部分 |
| --- | --- | --- |
| 第3〜5回 | $f(x)$ | なし |
| 第6〜8回 | $f(x) + u(t)$ | 観測値を補間した入力 |
| 第9回 | $f(t, x)$ | 周期関数として仮定した入力 |

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第9回の作業フォルダを作成する．データフォルダは共通のものを使う．

```bash
mkdir -p ~/applied_programming_ii/09
cd ~/applied_programming_ii/09
mkdir -p notebooks reports/figures
```

2. 講義サイトの[授業用データ一覧](../data/README.md)から`visitors_monthly.csv`をダウンロードし，`~/applied_programming_ii/data/`に置く．

3. `notebooks/periodic_forcing.ipynb`を新規作成する．

4. `09`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第9回

- 氏名：
- 学籍番号：

## 今日の目標

訪日外客数の周期性を周期モデルで表し，残差から周期性以外の要因を読み取る．

## 計算条件

- データ：訪日外客数（月次，JNTO）
- 当てはめ期間：2012年1月〜2019年12月
- 周期：T = 1 年
- 単位：万人/月

## 演習1〜4の記録

- 変更した条件：
- 実行前の予想：
- 実行後に分かったこと：

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

PROJECT_DIR = Path.home() / "applied_programming_ii" / "09"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("訪日外客数データの有無:", (DATA_DIR / "visitors_monthly.csv").exists())
```
````

## 導入：訪日外客数の時系列

日本政府観光局（JNTO）が公表する訪日外客数は，月ごとの人数である．
2003年1月から最新月までの総数を読み込み，時間軸を「年」の単位に直す．
$k$ 月の値はその月の合計なので，時刻は月の中央 $t = \text{年} + (k - 0.5)/12$ に置く．

```python
visitors = pd.read_csv(DATA_DIR / "visitors_monthly.csv")

# 時間軸 [年]．各月の値を月の中央の時刻に対応させる．
visitors["t"] = visitors["year"] + (visitors["month"] - 0.5) / 12
# 単位を人から万人に直す．
visitors["visitors_10k"] = visitors["visitors"] / 1e4

print(visitors.head())
print("期間:", visitors["t"].min().round(3), "〜", visitors["t"].max().round(3), " 行数:", len(visitors))
print("2019年の合計: {:.0f} 万人，2020年の合計: {:.0f} 万人".format(
    visitors.loc[visitors["year"] == 2019, "visitors_10k"].sum(),
    visitors.loc[visitors["year"] == 2020, "visitors_10k"].sum()))
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(visitors["t"], visitors["visitors_10k"], color="black", linewidth=1, marker="o", markersize=2, label="observed (monthly total)")
ax.set_title("Monthly foreign visitors to Japan (JNTO)")
ax.set_xlabel("Year")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_observed.png", dpi=150)
plt.show()
```

この図には3種類の変動が重なっている．

- 長期的な増加傾向．2012年の約70万人/月から2019年の約270万人/月まで増えた
- 1年ごとに繰り返す上下．毎年春と夏に山，冬に谷がある
- 傾向にも周期にも当てはまらない急変．2011年3月の東日本大震災，2020年2月以降の新型コロナウイルス感染症による渡航制限

2012年から2019年の期間について，月ごとの平均値を求めると周期性がはっきり見える．

```python
fit_mask = (visitors["year"] >= 2012) & (visitors["year"] <= 2019)
fit_data = visitors[fit_mask].copy()

monthly_mean = fit_data.groupby("month")["visitors_10k"].mean()
print("2012〜2019年の月別平均 [万人/月]")
print(monthly_mean.round(1))

fig, ax = plt.subplots(figsize=(7, 4))
ax.bar(monthly_mean.index, monthly_mean.values, color="lightgray", edgecolor="black")
ax.set_title("Average visitors by month (2012-2019)")
ax.set_xlabel("Month")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.set_xticks(range(1, 13))
ax.grid(True, axis="y")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_by_month.png", dpi=150)
plt.show()
```

4月と7月が高く，9月と2月が低い．
ただし，月別平均の差は最大で約40万人であり，同じ期間の増加傾向（8年で約200万人）に比べると小さい．
周期成分を見るには，まず傾向を取り除く必要がある．

```{tip} 観測量と状態変数
訪日外客数は「その月に入国した外国人の延べ人数」という流量であり，ある時刻に日本にいる外国人の数という貯蔵量ではない．
今回は，この月次の流量そのものを説明したい量として扱う．
状態変数と観測量が同じ種類の量である点は，ダムの貯水位と貯水量のように換算が必要だった第6回と異なる．
```

## 周期を式で表す

### 正弦関数の振幅，周期，位相

周期的な変動の最も単純な表現は正弦関数である．

$$
s(t) = A \sin\left(\frac{2\pi}{T}\,t + \phi\right)
$$

| 記号 | 意味 | 図での見え方 | 単位 |
| --- | --- | --- | --- |
| $A$ | 振幅 | 山の高さ．平均からの最大のずれ | 状態変数と同じ |
| $T$ | 周期 | 山から次の山までの時間 | 時間 |
| $\phi$ | 位相 | 曲線を時間方向にずらす量．$\phi > 0$ なら左へずれる | 無次元（ラジアン） |

```python
t_demo = np.linspace(0, 3, 301)   # 3年分 [年]
T = 1.0                            # 周期 [年]

fig, axes = plt.subplots(1, 3, figsize=(12, 3.4))
for A_demo in [1.0, 2.0]:
    axes[0].plot(t_demo, A_demo * np.sin(2 * np.pi * t_demo / T), label=f"A = {A_demo}")
axes[0].set_title("Amplitude A (T = 1, phi = 0)")
for T_demo in [1.0, 0.5]:
    axes[1].plot(t_demo, np.sin(2 * np.pi * t_demo / T_demo), label=f"T = {T_demo} year")
axes[1].set_title("Period T (A = 1, phi = 0)")
for phi_demo in [0.0, np.pi / 2]:
    axes[2].plot(t_demo, np.sin(2 * np.pi * t_demo / T + phi_demo), label=f"phi = {phi_demo:.2f}")
axes[2].set_title("Phase phi (A = 1, T = 1)")
for ax in axes:
    ax.set_xlabel("Time [year]")
    ax.set_ylabel("s(t)")
    ax.grid(True)
    ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sine_parameters.png", dpi=150)
plt.show()
```

位相 $\phi$ は，山がどの時刻に来るかを決める．
$\sin$ の山は引数が $\pi/2$ のときなので，最初の山は $t = (\pi/2 - \phi)\,T / (2\pi)$ に現れる．

### 位相を線形化する

最小二乗法で当てはめるとき，$\phi$ が $\sin$ の中に入っていると扱いにくい．
三角関数の加法定理を使うと，

$$
A \sin\left(\frac{2\pi}{T}t + \phi\right)
= \underbrace{A\cos\phi}_{\beta_s}\,\sin\frac{2\pi t}{T}
+ \underbrace{A\sin\phi}_{\beta_c}\,\cos\frac{2\pi t}{T}
$$

と書ける．
$\sin$ と $\cos$ の係数 $\beta_s$，$\beta_c$ を求めれば，振幅と位相は

$$
A = \sqrt{\beta_s^2 + \beta_c^2},
\qquad
\phi = \operatorname{atan2}(\beta_c, \beta_s)
$$

から復元できる．
係数が線形に入るので，通常の最小二乗法が使える．

### 周期モデル：ベースライン，トレンド，周期成分

訪日外客数を，次の3つの成分の和として表す．

$$
g(t) = \underbrace{\beta_0}_{\text{ベースライン}}
+ \underbrace{\beta_1\,(t - t_{\mathrm{ref}})}_{\text{トレンド}}
+ \underbrace{\beta_s \sin\frac{2\pi t}{T} + \beta_c \cos\frac{2\pi t}{T}}_{\text{周期成分}}
$$

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $\beta_0$ | 基準時刻 $t_{\mathrm{ref}}$ における平均的な水準 | 万人/月 |
| $\beta_1$ | 1年あたりの増加量 | 万人/月/年 |
| $\beta_s$，$\beta_c$ | 周期成分の係数．振幅 $A$ と位相 $\phi$ に対応 | 万人/月 |
| $T$ | 周期．年周期なら $T = 1$ 年 | 年 |

この式には微分が含まれていない．
$g(t)$ は時刻を入れれば値が出る関数であり，状態変数の変化率を指定するものではない．
このような表現を，ここでは**回帰的な周期モデル**と呼ぶ．

## 最小二乗法による当てはめ

第7回では`scipy.optimize.least_squares`を使った．
今回のモデルは係数について線形なので，`np.linalg.lstsq`で直接解ける．
説明変数を並べた行列 $X$ と観測値のベクトル $y$ について，$\|X\beta - y\|^2$ を最小にする $\beta$ を求める．

当てはめ期間は2012年1月から2019年12月とし，2020年以降は検証に使う．

```python
T = 1.0             # 周期 [年]
t_ref = 2012.0      # トレンドの基準時刻 [年]


def design_matrix(t, T=1.0, t_ref=2012.0):
    """ベースライン，トレンド，年周期の sin と cos を列に持つ行列を返す．"""
    return np.column_stack([
        np.ones_like(t),
        t - t_ref,
        np.sin(2 * np.pi * t / T),
        np.cos(2 * np.pi * t / T),
    ])


t_fit = fit_data["t"].values
y_fit = fit_data["visitors_10k"].values

X_fit = design_matrix(t_fit, T, t_ref)
beta, residual_sum, rank, singular_values = np.linalg.lstsq(X_fit, y_fit, rcond=None)

beta_0, beta_1, beta_s, beta_c = beta
amplitude = np.hypot(beta_s, beta_c)
phase = np.arctan2(beta_c, beta_s)
peak_time = ((np.pi / 2 - phase) / (2 * np.pi)) * T % T    # 年内で最初の山の時刻 [年]

print(f"ベースライン beta_0 = {beta_0:7.2f} 万人/月（{t_ref:.0f}年時点）")
print(f"トレンド     beta_1 = {beta_1:7.2f} 万人/月/年")
print(f"周期成分     beta_s = {beta_s:7.2f}, beta_c = {beta_c:7.2f} 万人/月")
print(f"振幅 A = {amplitude:.2f} 万人/月，位相 phi = {phase:.3f} rad，最初の山 = 年初から {12 * peak_time:.1f} か月目")
```

トレンドは1年あたり約32万人/月の増加，年周期の振幅は約13万人/月と推定される．
山は4月中旬ごろに来る．

### 観測値，当てはめ，残差の図

当てはめ期間だけでなく，2003年から最新月まで全期間に $g(t)$ を延長して描く．
残差 $y_i - g(t_i)$ を下段に描くと，周期性で説明できない変動が見えてくる．

```python
t_all = visitors["t"].values
y_all = visitors["visitors_10k"].values
g_all = design_matrix(t_all, T, t_ref) @ beta
residual_all = y_all - g_all

fig, (ax_top, ax_bottom) = plt.subplots(2, 1, figsize=(9, 6.5), sharex=True)
ax_top.plot(t_all, y_all, color="black", linewidth=1, marker="o", markersize=2, label="observed")
ax_top.plot(t_all, g_all, color="tab:blue", label="periodic model g(t)")
ax_top.axvspan(2012, 2020, color="lightgray", alpha=0.4, label="fitting period")
ax_top.set_title("Periodic model (baseline + trend + annual cycle) fitted to 2012-2019")
ax_top.set_ylabel("Visitors [10^4 persons/month]")
ax_top.set_ylim(-50, 450)
ax_top.grid(True)
ax_top.legend(loc="upper left")

ax_bottom.plot(t_all, residual_all, color="tab:red", linewidth=1, marker="o", markersize=2)
ax_bottom.axhline(0, color="black", linewidth=0.8)
ax_bottom.axvspan(2012, 2020, color="lightgray", alpha=0.4)
ax_bottom.set_xlabel("Year")
ax_bottom.set_ylabel("Residual [10^4 persons/month]")
ax_bottom.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_periodic_fit.png", dpi=150)
plt.show()

rmse_fit = np.sqrt(np.mean(residual_all[fit_mask.values] ** 2))
print(f"当てはめ期間の RMSE = {rmse_fit:.1f} 万人/月")
```

当てはめ期間の残差は数十万人/月の範囲に収まる．
一方，2020年2月以降の残差は $-300$ 万人/月を超える．
モデルが「渡航制限がなければこうなっていたはず」という値を出し続けるため，観測値との差がそのまま感染症の影響の大きさを表している．

````{note} 演習1：周期を追加する

年周期だけでは，4月と7月の2つの山を表せない．
半年周期 $T = 0.5$ 年の $\sin$ と $\cos$ の列を`design_matrix`に追加した関数`design_matrix_two`を作り，同じ期間に当てはめる．

1. 当てはめ期間の RMSE はどれだけ小さくなるか．
2. 月別平均の図と見比べ，2つ目の周期成分が何を表しているかを説明する．
3. RMSE がほとんど下がらないのはなぜか．残差の図で，残差の大きい部分が周期的かどうかを確かめて説明する．
4. 周期成分をさらに増やせば RMSE は少しずつ下がる．それでも成分を増やし続けるべきではない理由を，第4回と第8回の議論を思い出して書く．
````

```{dropdown} 演習1の確認
半年周期を加えても，当てはめ期間の RMSE は約18.0万人/月から約17.9万人/月へとほとんど変わらない．
半年周期の振幅は約2万人/月にとどまる．
月別平均で見えた4月と7月の山は，8年間で約200万人という増加傾向の前では小さく，残差の大部分は周期ではなく，直線で表したトレンドと実際の増え方のずれから来ている．
成分を増やせば当てはめは少しずつ改善するが，各成分の意味は説明しにくくなり，当てはめ期間の外での予測は不安定になる．
第4回で見た「複雑なモデルが常に良いとは限らない」の別の例である．
```

## 緩和モデル：周期的な目標に遅れて追いつく

### 仮定と導出

ここまでの $g(t)$ は，時刻を決めれば値が決まる関数だった．
これを微分方程式に組み込むには，「状態変数がどのような仕組みで $g(t)$ に近づくか」という仮定が必要である．

**仮定**：状態変数 $x$ は，そのときの目標値 $g(t)$ との差に比例する速さで目標に近づく．

$$
\frac{dx}{dt} = -\lambda\,\bigl(x - g(t)\bigr)
$$

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $x$ | 状態変数．ここでは月あたりの訪日外客数の水準 | 万人/月 |
| $g(t)$ | 周期モデルが与える目標値 | 万人/月 |
| $x - g(t)$ | 目標からのずれ | 万人/月 |
| $\lambda$ | 追いつく速さ．$1/\lambda$ が目標に近づく時間の目安 | 1/年 |

$x > g$ なら右辺は負で $x$ は減り，$x < g$ なら増える．
$g$ が一定なら $x$ は $g$ に指数的に近づき，その時定数は $1/\lambda$ である．
$g$ が周期的に動くと，$x$ は遅れて追いかける．
$\lambda$ が大きければほぼ $g$ に一致し，$\lambda$ が小さければ振幅が小さくなって山が遅れる．

### 実装

右辺の関数は，時刻 $t$，状態 $x$，パラメタ $\lambda$，そして $g(t)$ の係数を受け取る．
`solve_ivp`は刻み幅を自動で決めるが，右辺が1年周期で変動するので，`max_step`で刻み幅の上限を与えて周期を飛び越えないようにする．

```python
def periodic_target(t, beta, T=1.0, t_ref=2012.0):
    """周期モデル g(t) の値を返す．t はスカラーまたは配列．"""
    t = np.asarray(t, dtype=float)
    return (beta[0] + beta[1] * (t - t_ref)
            + beta[2] * np.sin(2 * np.pi * t / T) + beta[3] * np.cos(2 * np.pi * t / T))


def relaxation_rhs(t, x, lam, beta):
    """dx/dt = -lam * (x - g(t)) の右辺．"""
    return -lam * (x - periodic_target(t, beta))


lam = 4.0                          # 追いつく速さ [1/年]．時定数は 3 か月
t_span = (t_fit[0], t_fit[-1])
x0 = y_fit[0]                      # 2012年1月の観測値を初期値にする

sol = solve_ivp(relaxation_rhs, t_span, [x0], t_eval=t_fit, args=(lam, beta), max_step=1 / 24)
x_relax = sol.y[0]

rmse_relax = np.sqrt(np.mean((x_relax - y_fit) ** 2))
print(f"緩和モデル（lambda = {lam}）の RMSE = {rmse_relax:.1f} 万人/月")
print(f"周期モデル g(t) の RMSE        = {rmse_fit:.1f} 万人/月")
```

```python
fig, ax = plt.subplots(figsize=(9, 4))
ax.plot(t_fit, y_fit, color="black", linewidth=1, marker="o", markersize=2, label="observed")
ax.plot(t_fit, periodic_target(t_fit, beta), color="tab:blue", label="target g(t)")
ax.plot(t_fit, x_relax, color="tab:orange", linestyle="--", label=f"relaxation model, lambda = {lam} /year")
ax.set_title("Relaxation toward a periodic target (2012-2019)")
ax.set_xlabel("Year")
ax.set_ylabel("Visitors [10^4 persons/month]")
ax.grid(True)
ax.legend(loc="upper left")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "visitors_relaxation.png", dpi=150)
plt.show()
```

### 回帰的な周期モデルと緩和モデルの違い

| 観点 | 周期モデル $g(t)$ | 緩和モデル $x' = -\lambda(x - g(t))$ |
| --- | --- | --- |
| 式の種類 | 時刻の関数 | 微分方程式 |
| 表しているもの | 各時刻の値そのもの | 値が目標に近づく仕組み |
| 初期条件 | 不要 | 必要 |
| 追加のパラメタ | なし | $\lambda$ |
| 当てはまり | 係数を最小二乗で決めれば最良 | $\lambda \to \infty$ で $g(t)$ に一致．有限なら必ず悪くなる |
| 意味を持つ場面 | 周期性の記述と予測 | 需要が急に変わったときの回復の速さ，慣性のある量 |

観測値との当てはまりだけを見れば，緩和モデルは周期モデルより良くならない．
$\lambda$ を大きくすれば $g(t)$ に一致するだけである．
それでも緩和モデルに意味があるのは，「目標が急に変わったとき，どれだけ遅れて追いつくか」を $\lambda$ が表すからである．
2020年に目標がほぼゼロに落ち，2022年後半から回復した過程は，緩和の速さで議論できる現象の1つである．

逆に，「毎年4月に山が来る」という事実を説明したいだけなら，微分方程式を持ち出す理由はない．
時間依存の項を持つモデルを作るときは，その項が「仕組み」を表しているのか「記述」にとどまっているのかを区別する．

````{note} 演習2：追いつく速さを変える

`lam`を`1.0`，`4.0`，`12.0`，`50.0`に変えて計算し，次を`README.md`に記録する．

1. それぞれの RMSE．
2. 図の上で，緩和モデルの山が目標 $g(t)$ の山からどれだけ遅れているか，振幅がどれだけ小さくなっているか．
3. $\lambda = 1$ /年は時定数1年に対応する．年周期の目標を時定数1年で追いかけると何が起きるか，図を根拠に説明する．
````

```{dropdown} 演習2の確認
$\lambda = 1$ では RMSE が約34万人/月と大きく，山が数か月遅れ，振幅も小さくなる．
$\lambda = 4$ で約20万人/月，$\lambda = 12$ 以上ではほぼ $g(t)$ と同じ約18万人/月になる．
時定数が周期と同じ長さだと，目標が1周する間に追いつけず，山と谷がならされてしまう．
```

## オープンデータとの比較：残差を読む

周期モデルの残差 $y_i - g(t_i)$ は，「トレンドと年周期で説明できなかった部分」である．
残差の時系列から，モデルに入っていない要因を探す．

```python
residual_series = pd.DataFrame({
    "year": visitors["year"],
    "month": visitors["month"],
    "t": t_all,
    "observed": y_all,
    "model": g_all,
    "residual": residual_all,
})

print("残差が大きい月（当てはめ期間内，絶対値の上位5件）")
inside = residual_series[fit_mask.values]
print(inside.reindex(inside["residual"].abs().sort_values(ascending=False).index).head(5).round(1).to_string(index=False))

print("\n2020年の各月の残差 [万人/月]")
print(residual_series[residual_series["year"] == 2020][["month", "observed", "model", "residual"]].round(1).to_string(index=False))
```

````{note} 演習3：残差の要因を挙げる

1. 当てはめ期間内で残差の絶対値が大きい月について，その月に何があったかを調べて`README.md`に書く．候補は，祝日や連休の並び，天候，自然災害，為替，ビザ制度の変更，大規模な行事などである．
2. 2020年から2022年の残差の推移から，渡航制限の開始と緩和の時期を読み取る．
3. 2023年以降の観測値は，2019年までの傾向を延長した $g(t)$ と比べてどうか．傾向が元に戻ったと言えるか，別のトレンドに乗ったと言えるか．
````

```{tip} 残差はモデルの外側を映す
残差が大きい期間は，モデルの失敗ではなく，モデルに含めていない要因が働いた期間である．
第4回で人口の減少がLogisticモデルに含まれない要因を示したように，訪日外客数の残差は感染症や災害という要因を示している．
これらを「周期的」と見なして式に入れることはできない．
入れられないものを入れないという判断も，モデル化の一部である．
```

## 発展：電力需要と複数の周期

電力需要は，観光と同じ数学的な構造で説明できる題材である．
違いは，周期が「年」だけでなく「週」と「日」にもあることである．

東京電力パワーグリッドの「でんき予報」は，過去の電力使用実績を1時間ごとのCSVで公開している．
このデータは，同社のサイト利用規約により，私的利用を超える転載や複製が禁止されている．
そのため講義サイトには同梱せず，各自が公開元から直接取得する．
取得できない場合に授業を続けられるように，次のコードは取得に失敗したとき，明示的に「生成データ」と表示した上で，周期構造だけを模した人工データに切り替える．

```python
TEPCO_URL = "https://www.tepco.co.jp/forecast/html/images/juyo-2019.csv"

try:
    # 1行目は更新日時，2行目は空行，3行目が列名 DATE, TIME, 実績(万kW)
    raw = pd.read_csv(TEPCO_URL, encoding="shift_jis", skiprows=2)
    raw.columns = ["date", "time", "demand_10MW"]
    raw["datetime"] = pd.to_datetime(raw["date"] + " " + raw["time"], format="%Y/%m/%d %H:%M")
    electricity = raw[["datetime", "demand_10MW"]].copy()
    data_label = "TEPCO 2019 (downloaded)"
    print("東京電力の実績データを取得した．出典：東京電力パワーグリッド「でんき予報」過去の電力使用実績データ")
except Exception as error:
    print("取得に失敗した:", type(error).__name__)
    print("代わりに，周期構造だけを模した生成データを使う．これは実測値ではない．")
    rng = np.random.default_rng(0)
    hours = pd.date_range("2019-01-01", "2019-12-31 23:00", freq="h")
    hour_of_day = hours.hour.values
    day_of_year = hours.dayofyear.values
    weekday = hours.weekday.values
    daily_cycle = 700 * np.sin(2 * np.pi * (hour_of_day - 8) / 24)
    weekly_cycle = np.where(weekday >= 5, -350.0, 0.0)
    annual_cycle = 400 * np.cos(2 * np.pi * (day_of_year - 25) / 365) + 500 * np.exp(-((day_of_year - 220) / 30) ** 2)
    demand = 3300 + daily_cycle + weekly_cycle + annual_cycle + rng.normal(0, 60, len(hours))
    electricity = pd.DataFrame({"datetime": hours, "demand_10MW": demand})
    data_label = "synthetic data (NOT measured)"

electricity["hour"] = electricity["datetime"].dt.hour
electricity["weekday"] = electricity["datetime"].dt.weekday
electricity["month"] = electricity["datetime"].dt.month
print("行数:", len(electricity), " 使用データ:", data_label)
```

```python
fig, axes = plt.subplots(1, 3, figsize=(13, 3.6))

hourly = electricity[electricity["month"] == 8].groupby("hour")["demand_10MW"].mean()
axes[0].plot(hourly.index, hourly.values, marker="o", markersize=3)
axes[0].set_title("Daily cycle (August average)")
axes[0].set_xlabel("Hour of day")

weekly = electricity.groupby("weekday")["demand_10MW"].mean()
axes[1].bar(weekly.index, weekly.values, color="lightgray", edgecolor="black")
axes[1].set_title("Weekly cycle (Mon=0 ... Sun=6)")
axes[1].set_xlabel("Day of week")

monthly = electricity.groupby("month")["demand_10MW"].mean()
axes[2].plot(monthly.index, monthly.values, marker="s", markersize=4)
axes[2].set_title("Annual cycle (monthly average)")
axes[2].set_xlabel("Month")
axes[2].set_xticks(range(1, 13))

for ax in axes:
    ax.set_ylabel("Demand [10 MW]")
    ax.grid(True)
fig.suptitle(f"Electricity demand, TEPCO area: {data_label}")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "electricity_cycles.png", dpi=150)
plt.show()
```

実測データでは，日周期は昼に高く深夜に低い山型，週周期は土日が平日より約1割低く，年周期は冬と夏に山，春と秋に谷を持つ．
観光と同じ「ベースライン＋周期成分」の構造で書けるが，周期が3つあり，しかも夏の山は気温に強く依存する．
周期関数だけでは説明しきれない部分が，気温という外部入力による残差として現れる．

````{dropdown} 発展演習：3つの周期を持つモデル

1. 電力需要について，日周期（$T = 1$ 日），週周期（$T = 7$ 日），年周期（$T = 365$ 日）の $\sin$，$\cos$ を列に持つ行列を作り，`np.linalg.lstsq`で当てはめる．時間軸は「1月1日0時からの経過日数」にする．
2. 残差を月ごとに平均し，どの季節に残差が大きいかを調べる．気温との関係を推測する．
3. 週周期を正弦関数で表すことの限界を，土日と平日の違いの形から説明する．正弦関数の代わりにどのような表現が考えられるか．

実測データが取得できた場合は，出典として「東京電力パワーグリッド『でんき予報』過去の電力使用実績データ」と取得日を`README.md`に記録する．
````

## モデルの限界と改善の問い

- 周期モデルは「毎年同じ形で繰り返す」と仮定している．祝日の並び，うるう年，旧正月の時期の違いは年ごとに変わるため，年周期の正弦関数では表せない
- トレンドを直線で表したが，2012年から2019年の訪日外客数の増加は直線より速い．対数を取って当てはめる，あるいは第4回のLogistic型の飽和を入れる，といった選択肢がある
- 緩和モデルの $\lambda$ は，今回は手で与えた．第7回の方法で推定できるが，$\lambda$ が大きいほど当てはまりが良くなるだけなので，「当てはまり」以外の情報，例えば急変後の回復の速さを使わないと決まらない
- 感染症や災害のような一回限りの要因は，周期モデルの外に置いた．これらを扱うには，第11回の感染症モデルのように，その要因自体をモデル化する必要がある

## まとめ

- 周期的な変動は，振幅，周期，位相を持つ正弦関数で表せる．位相は $\sin$ と $\cos$ の係数に分けると線形に扱える
- ベースライン，トレンド，周期成分の和からなる周期モデルは，`np.linalg.lstsq`で当てはめられる．当てはめ期間の外での残差は，モデルに含めていない要因の大きさを示す
- 緩和モデル $x' = -\lambda(x - g(t))$ は，周期的な目標に遅れて追いつく仕組みを表す．当てはまりでは周期モデルに勝てないが，急変後の回復の速さという別の情報を表現できる
- 観光と電力需要は同じ数学的な構造で説明できる．周期性だけでは説明できない部分は，残差として外部要因を映し出す
- 微分方程式は万能ではない．時間依存の項が仕組みを表すのか記述にとどまるのかを区別する

## 課題

````{warning} 課題1：周期モデルの当てはめと残差

1. 訪日外客数について，年周期と半年周期を含む周期モデルを2012〜2019年に当てはめ，2003年から最新月までの観測値，モデル，残差を上下2段の図にして`reports/figures/`に保存する．
2. 推定した係数から，年周期と半年周期それぞれの振幅と，山が来る月を求めて表にする．
3. 当てはめ期間内で残差の絶対値が大きい上位3か月について，考えられる要因を1行ずつ書く．
````

````{warning} 課題2：周期モデルと微分方程式モデルの使い分け

次の3つの問いについて，それぞれ「周期モデルが自然」「緩和モデルが自然」「どちらも不適切」のいずれかを選び，理由を含めて合計300字程度で答える．

- 来年4月の訪日外客数を見積もりたい
- 渡航制限が解除されてから，訪日外客数が以前の水準に戻るまでの時間を説明したい
- 2020年2月に訪日外客数が急減した理由を説明したい

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

ここまでのモデルは，状態変数が1つだった．
第10回では，被食者と捕食者のように，互いに影響し合う2つの状態変数を同時に扱う．
状態変数がベクトルになり，`solve_ivp`に渡す初期値と右辺の戻り値が2成分になる．
時系列だけでなく，2つの状態変数を軸にした相平面という新しい図の見方も学ぶ．

## 自分の言葉で説明する問い

1. 正弦関数の振幅，周期，位相は，訪日外客数の図のどこに対応するか．
2. 周期モデル $g(t)$ と緩和モデル $x' = -\lambda(x - g(t))$ は何が違うか．後者を使う意味がある状況を1つ挙げよ．
3. 2020年の残差が $-300$ 万人/月を超えたことは，モデルの失敗と言えるか．言えるとすればどのような意味で，言えないとすればなぜか．
4. 観光と電力需要が「同じ数学的な構造で説明できる」とはどういうことか．両者で異なる点も1つ挙げよ．
